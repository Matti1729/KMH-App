import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';

interface AccessRequest {
  id: string;
  player_id: string;
  requester_id: string;
  status: string;
  created_at: string;
  player_name: string;
  requester_name: string;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
}

export function AdminPanelScreen({ navigation }: any) {
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'advisors'>('requests');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPendingRequests(), fetchAdvisors()]);
    setLoading(false);
  };

  // UPDATED: Nutzt jetzt access_requests statt player_access
  const fetchPendingRequests = async () => {
    const { data: requests, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('status', 'pending');

    console.log('Pending requests:', requests, 'Error:', error);

    if (requests && requests.length > 0) {
      // Get player names
      const playerIds = requests.map(r => r.player_id);
      const { data: players } = await supabase
        .from('player_details')
        .select('id, first_name, last_name')
        .in('id', playerIds);

      // Get requester names from advisors table
      const requesterIds = requests.map(r => r.requester_id);
      const { data: advisorData } = await supabase
        .from('advisors')
        .select('id, first_name, last_name')
        .in('id', requesterIds);

      const enrichedRequests = requests.map(req => ({
        ...req,
        player_name: players?.find(p => p.id === req.player_id)
          ? `${players.find(p => p.id === req.player_id)?.first_name} ${players.find(p => p.id === req.player_id)?.last_name}`
          : 'Unbekannt',
        requester_name: advisorData?.find(a => a.id === req.requester_id)
          ? `${advisorData.find(a => a.id === req.requester_id)?.first_name} ${advisorData.find(a => a.id === req.requester_id)?.last_name}`
          : 'Unbekannt'
      }));

      setPendingRequests(enrichedRequests);
    } else {
      setPendingRequests([]);
    }
  };

  const fetchAdvisors = async () => {
    const { data } = await supabase
      .from('advisors')
      .select('id, first_name, last_name, role')
      .order('last_name');

    if (data) setAdvisors(data);
  };

  // UPDATED: Erstellt advisor_access Eintrag + updated access_requests
  const handleApprove = async (request: AccessRequest) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Erstelle Eintrag in advisor_access
    const { error: accessError } = await supabase
      .from('advisor_access')
      .insert({
        player_id: request.player_id,
        advisor_id: request.requester_id,
        granted_by: user.id,
        granted_at: new Date().toISOString()
      });

    if (accessError) {
      // Wenn bereits existiert (unique constraint), ist das ok
      if (accessError.code !== '23505') {
        Alert.alert('Fehler', accessError.message);
        return;
      }
    }

    // 2. Update access_requests Status auf 'approved'
    const { error: updateError } = await supabase
      .from('access_requests')
      .update({ status: 'approved' })
      .eq('id', request.id);

    if (updateError) {
      Alert.alert('Fehler', updateError.message);
      return;
    }

    // 3. Optional: Update responsibility Feld beim Spieler
    const requesterName = request.requester_name;
    const { data: playerData } = await supabase
      .from('player_details')
      .select('responsibility')
      .eq('id', request.player_id)
      .single();

    if (playerData) {
      const currentResp = playerData.responsibility || '';
      // Nur hinzufügen wenn nicht bereits vorhanden
      if (!currentResp.includes(requesterName)) {
        const newResp = currentResp ? `${currentResp}, ${requesterName}` : requesterName;
        await supabase
          .from('player_details')
          .update({ responsibility: newResp })
          .eq('id', request.player_id);
      }
    }

    Alert.alert('Erfolg', 'Anfrage genehmigt');
    fetchPendingRequests();
  };

  // UPDATED: Setzt access_requests Status auf 'rejected'
  const handleReject = async (requestId: string) => {
    const { error } = await supabase
      .from('access_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Erfolg', 'Anfrage abgelehnt');
      fetchPendingRequests();
    }
  };

  const handleChangeRole = async (advisorId: string, newRole: string) => {
    const { error } = await supabase
      .from('advisors')
      .update({ role: newRole })
      .eq('id', advisorId);

    if (error) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('Erfolg', 'Rolle geändert');
      fetchAdvisors();
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Administration</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Anfragen {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'advisors' && styles.tabActive]}
          onPress={() => setActiveTab('advisors')}
        >
          <Text style={[styles.tabText, activeTab === 'advisors' && styles.tabTextActive]}>
            Benutzer
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Laden...</Text>
        ) : activeTab === 'requests' ? (
          /* Pending Requests */
          pendingRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Keine offenen Anfragen</Text>
            </View>
          ) : (
            pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestAdvisor}>{request.requester_name}</Text>
                  <Text style={styles.requestText}>möchte Zugriff auf</Text>
                  <Text style={styles.requestPlayer}>{request.player_name}</Text>
                  <Text style={styles.requestDate}>Angefragt am {formatDate(request.created_at)}</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApprove(request)}
                  >
                    <Text style={styles.approveButtonText}>Genehmigen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(request.id)}
                  >
                    <Text style={styles.rejectButtonText}>Ablehnen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : (
          /* Advisors List */
          advisors.map((advisor) => (
            <View key={advisor.id} style={styles.advisorCard}>
              <View style={styles.advisorInfo}>
                <Text style={styles.advisorName}>
                  {advisor.first_name} {advisor.last_name}
                </Text>
                <View style={[styles.roleBadge, advisor.role === 'admin' ? styles.roleAdmin : styles.roleBerater]}>
                  <Text style={styles.roleBadgeText}>
                    {advisor.role === 'admin' ? 'Admin' : 'Berater'}
                  </Text>
                </View>
              </View>
              <View style={styles.advisorActions}>
                {advisor.role !== 'admin' ? (
                  <TouchableOpacity
                    style={styles.makeAdminButton}
                    onPress={() => handleChangeRole(advisor.id, 'admin')}
                  >
                    <Text style={styles.makeAdminButtonText}>Zum Admin</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.removeAdminButton}
                    onPress={() => handleChangeRole(advisor.id, 'berater')}
                  >
                    <Text style={styles.removeAdminButtonText}>Admin entfernen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  backButtonText: { fontSize: 20, color: '#333' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 40 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#000' },
  tabText: { fontSize: 15, color: '#666' },
  tabTextActive: { color: '#000', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 16 },
  requestCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  requestInfo: { marginBottom: 12 },
  requestAdvisor: { fontSize: 16, fontWeight: '600', color: '#000' },
  requestText: { fontSize: 14, color: '#666', marginVertical: 4 },
  requestPlayer: { fontSize: 16, fontWeight: '600', color: '#000' },
  requestDate: { fontSize: 12, color: '#999', marginTop: 8 },
  requestActions: { flexDirection: 'row', gap: 8 },
  approveButton: { flex: 1, backgroundColor: '#000', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  approveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rejectButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#dc3545', alignItems: 'center' },
  rejectButtonText: { color: '#dc3545', fontSize: 14, fontWeight: '600' },
  advisorCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  advisorInfo: { flex: 1 },
  advisorName: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
  roleBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start' },
  roleAdmin: { backgroundColor: '#000' },
  roleBerater: { backgroundColor: '#5bc0de' },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  advisorActions: {},
  makeAdminButton: { backgroundColor: '#000', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  makeAdminButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  removeAdminButton: { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ff4444' },
  removeAdminButtonText: { color: '#ff4444', fontSize: 13, fontWeight: '600' },
});
