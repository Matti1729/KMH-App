import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Sidebar } from '../../components/Sidebar';
import { MobileSidebar } from '../../components/MobileSidebar';
import { MobileHeader } from '../../components/MobileHeader';
import { useIsMobile } from '../../hooks/useIsMobile';

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
  phone?: string;
  birth_date?: string;
}

interface Feedback {
  id: string;
  user_id: string;
  user_name: string;
  type: 'bug' | 'feature' | 'other';
  description: string;
  screen: string;
  status: 'open' | 'done';
  created_at: string;
}

export function AdminPanelScreen({ navigation }: any) {
  const { session, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const isMobile = useIsMobile();
  const dataLoadedRef = useRef(false);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'advisors' | 'feedback'>('requests');
  const [profile, setProfile] = useState<Advisor | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'makeAdmin' | 'removeAdmin' | 'approve' | 'reject' | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);

  // Daten nur laden wenn Auth bereit ist
  useEffect(() => {
    if (authLoading) return;
    if (!session) return;
    if (dataLoadedRef.current) return;

    dataLoadedRef.current = true;
    fetchData();
  }, [authLoading, session]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPendingRequests(), fetchAdvisors(), fetchFeedback(), fetchProfile()]);
    setLoading(false);
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('advisors')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    }
  };

  const fetchFeedback = async () => {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setFeedbackList(data);
  };

  const toggleFeedbackStatus = async (feedback: Feedback) => {
    const newStatus = feedback.status === 'open' ? 'done' : 'open';
    const { error } = await supabase
      .from('feedback')
      .update({ status: newStatus })
      .eq('id', feedback.id);

    if (!error) {
      fetchFeedback();
    }
  };

  const deleteFeedback = async (feedback: Feedback) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Feedback wirklich löschen?')) return;
    }
    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', feedback.id);

    if (!error) {
      fetchFeedback();
    }
  };

  const generatePrompt = (feedback: Feedback) => {
    const typeLabel = feedback.type === 'bug' ? 'Bug/Fehler' : feedback.type === 'feature' ? 'Verbesserung/Feature' : 'Sonstiges';
    const actionText = feedback.type === 'bug'
      ? 'Bitte finde und behebe den Fehler.'
      : feedback.type === 'feature'
        ? 'Bitte implementiere diese Verbesserung.'
        : 'Bitte analysiere und setze um.';

    return `${typeLabel} in der KMH Sports Agency App:

**Bereich/Screen:** ${feedback.screen}

**Beschreibung:**
${feedback.description}

${actionText}

Achte dabei auf:
- Dark Mode Kompatibilität (colors.* Theme-Farben verwenden)
- Mobile und Desktop Ansichten
- Bestehende Code-Patterns im Projekt
- Einheitliches Styling mit anderen Screens`;
  };

  const copyPrompt = (feedback: Feedback) => {
    const prompt = generatePrompt(feedback);
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(prompt).then(() => {
        window.alert('Prompt wurde kopiert!');
      });
    }
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
      .select('id, first_name, last_name, role, email, phone, birth_date')
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

  const openConfirmModal = (advisor: Advisor | null, request: AccessRequest | null, action: 'makeAdmin' | 'removeAdmin' | 'approve' | 'reject') => {
    setSelectedAdvisor(advisor);
    setSelectedRequest(request);
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    // Advisor actions
    if ((confirmAction === 'makeAdmin' || confirmAction === 'removeAdmin') && selectedAdvisor) {
      const newRole = confirmAction === 'makeAdmin' ? 'admin' : 'berater';
      const { error } = await supabase
        .from('advisors')
        .update({ role: newRole })
        .eq('id', selectedAdvisor.id);

      if (error) {
        Alert.alert('Fehler', error.message);
      } else {
        fetchAdvisors();
      }
    }

    // Request actions
    if (confirmAction === 'approve' && selectedRequest) {
      await handleApprove(selectedRequest);
    }
    if (confirmAction === 'reject' && selectedRequest) {
      await handleReject(selectedRequest.id);
    }

    setShowConfirmModal(false);
    setSelectedAdvisor(null);
    setSelectedRequest(null);
    setConfirmAction(null);
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

  const formatPhoneWithCountryCode = (phone: string | undefined) => {
    if (!phone) return null;
    let formatted = phone.trim();
    // Remove spaces and dashes for processing
    const cleaned = formatted.replace(/[\s\-]/g, '');
    // If starts with 0, replace with +49 (Germany)
    if (cleaned.startsWith('0')) {
      formatted = '+49 ' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      formatted = '+49 ' + cleaned;
    }
    return formatted;
  };

  const handlePhonePress = (phone: string | undefined) => {
    const formatted = formatPhoneWithCountryCode(phone);
    if (formatted) {
      const phoneNumber = formatted.replace(/[\s\-]/g, '');
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const profileInitials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}` : '?';

  return (
    <View style={[styles.container, isMobile && styles.containerMobile, { backgroundColor: colors.background }]}>
      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <MobileSidebar
          visible={showMobileSidebar}
          onClose={() => setShowMobileSidebar(false)}
          navigation={navigation}
          activeScreen="admin"
          profile={profile}
        />
      )}

      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar navigation={navigation} activeScreen="admin" profile={profile} />}

      <View style={[styles.mainContent, { backgroundColor: colors.background }]}>
        {/* Mobile Header */}
        {isMobile && (
          <MobileHeader
            title="Administration"
            onMenuPress={() => setShowMobileSidebar(true)}
            onProfilePress={() => navigation.navigate('MyProfile')}
            profileInitials={profileInitials}
          />
        )}

        {/* Desktop Header */}
        {!isMobile && (
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => navigation.navigate('AdvisorDashboard')} style={[styles.backButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>← Zurück</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Administration</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Benutzer, Anfragen und Feedback verwalten</Text>
            </View>
            <View style={styles.placeholder} />
          </View>
        )}

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive, activeTab === 'requests' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'requests' && { color: colors.text, fontWeight: '600' }]}>
            Anfragen {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'advisors' && styles.tabActive, activeTab === 'advisors' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('advisors')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'advisors' && { color: colors.text, fontWeight: '600' }]}>
            Benutzer
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feedback' && styles.tabActive, activeTab === 'feedback' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('feedback')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'feedback' && { color: colors.text, fontWeight: '600' }]}>
            Feedback {feedbackList.filter(f => f.status === 'open').length > 0 ? `(${feedbackList.filter(f => f.status === 'open').length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {loading ? (
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Laden...</Text>
        ) : activeTab === 'requests' ? (
          /* Pending Requests */
          pendingRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Keine offenen Anfragen</Text>
            </View>
          ) : (
            <View style={styles.requestsGrid}>
              {pendingRequests.map((request) => (
                <View key={request.id} style={[styles.requestCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <Text style={[styles.requestPlayer, { color: colors.text }]}>{request.player_name}</Text>
                      <Text style={[styles.requestAdvisor, { color: colors.textSecondary }]}>für {request.requester_name}</Text>
                    </View>
                    <Text style={[styles.requestDate, { color: colors.textMuted }]}>{formatDate(request.created_at)}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.approveButton, { backgroundColor: colors.primary }]}
                      onPress={() => openConfirmModal(null, request, 'approve')}
                    >
                      <Text style={[styles.approveButtonText, { color: colors.primaryText }]}>Genehmigen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => openConfirmModal(null, request, 'reject')}
                    >
                      <Text style={styles.rejectButtonText}>Ablehnen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : activeTab === 'advisors' ? (
          /* Advisors List - Admins first, side by side */
          <View style={[styles.advisorsGrid, isMobile && styles.advisorsGridMobile]}>
            {[...advisors].sort((a, b) => {
              if (a.role === 'admin' && b.role !== 'admin') return -1;
              if (a.role !== 'admin' && b.role === 'admin') return 1;
              return (a.last_name || '').localeCompare(b.last_name || '');
            }).map((advisor) => (
              <View key={advisor.id} style={[styles.advisorCard, isMobile && styles.advisorCardMobile, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                <View style={styles.advisorHeader}>
                  <View style={styles.advisorNameSection}>
                    <Text style={[styles.advisorName, { color: colors.text }]} numberOfLines={1}>
                      {advisor.first_name} {advisor.last_name}
                    </Text>
                    <Text style={[styles.advisorBirthDate, { color: colors.textMuted }]} numberOfLines={1}>
                      Geb.: {advisor.birth_date ? formatDate(advisor.birth_date) : '-'}
                    </Text>
                  </View>
                  <View style={[styles.roleBadge, advisor.role === 'admin' ? { backgroundColor: colors.primary } : styles.roleBerater]}>
                    <Text style={[styles.roleBadgeText, { color: advisor.role === 'admin' ? colors.primaryText : '#fff' }]}>
                      {advisor.role === 'admin' ? 'Admin' : 'Berater'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.advisorDivider, { borderBottomColor: colors.border }]} />
                <View style={styles.advisorBottomSection}>
                  <View style={styles.advisorDetails}>
                    <View style={styles.advisorDetailRow}>
                      <Text style={[styles.advisorDetailLabel, { color: colors.textMuted }]}>E-Mail: </Text>
                      {advisor.email ? (
                        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${advisor.email}`)} style={styles.advisorDetailValue}>
                          <Text style={[styles.advisorDetailText, styles.linkText, { color: colors.primary }]} numberOfLines={1}>
                            {advisor.email}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.advisorDetailText, { color: colors.textSecondary }]}>-</Text>
                      )}
                    </View>
                    <View style={styles.advisorDetailRow}>
                      <Text style={[styles.advisorDetailLabel, { color: colors.textMuted }]}>Tel.: </Text>
                      {advisor.phone ? (
                        <TouchableOpacity onPress={() => handlePhonePress(advisor.phone)} style={styles.advisorDetailValue}>
                          <Text style={[styles.advisorDetailText, styles.linkText, { color: colors.primary }]} numberOfLines={1}>
                            {formatPhoneWithCountryCode(advisor.phone)}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.advisorDetailText, { color: colors.textSecondary }]}>-</Text>
                      )}
                    </View>
                  </View>
                  {advisor.role !== 'admin' ? (
                    <TouchableOpacity
                      style={[styles.makeAdminButton, { backgroundColor: colors.primary }]}
                      onPress={() => openConfirmModal(advisor, null, 'makeAdmin')}
                    >
                      <Text style={[styles.makeAdminButtonText, { color: colors.primaryText }]}>Zum Admin</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.removeAdminButton, { backgroundColor: colors.surface, borderColor: '#ff4444' }]}
                      onPress={() => openConfirmModal(advisor, null, 'removeAdmin')}
                    >
                      <Text style={styles.removeAdminButtonText}>Entfernen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          /* Feedback List */
          feedbackList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Kein Feedback vorhanden</Text>
            </View>
          ) : (
            feedbackList.map((feedback) => (
              <View key={feedback.id} style={[styles.feedbackCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, feedback.status === 'done' && { opacity: 0.6, backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.feedbackHeader}>
                  <View style={styles.feedbackHeaderLeft}>
                    <View style={[
                      styles.feedbackTypeBadge,
                      feedback.type === 'bug' && { backgroundColor: isDark ? '#3f1f1f' : '#fef2f2' },
                      feedback.type === 'feature' && { backgroundColor: isDark ? '#1f3f1f' : '#f0fdf4' },
                      feedback.type === 'other' && { backgroundColor: isDark ? '#1f2f3f' : '#f0f9ff' },
                    ]}>
                      <Text style={[styles.feedbackTypeBadgeText, { color: colors.text }]}>
                        {feedback.type === 'bug' ? 'Bug' : feedback.type === 'feature' ? 'Idee' : 'Sonst.'}
                      </Text>
                    </View>
                    <Text style={[styles.feedbackScreen, { color: colors.textSecondary }]}>{feedback.screen}</Text>
                    <Text style={[styles.feedbackUser, { color: colors.textMuted }]}>• {feedback.user_name}</Text>
                    <Text style={[styles.feedbackDate, { color: colors.textMuted }]}>• {formatDate(feedback.created_at)}</Text>
                  </View>
                </View>
                <View style={[styles.feedbackDescriptionBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <Text style={[styles.feedbackDescription, { color: colors.text }]}>{feedback.description}</Text>
                </View>
                <View style={styles.feedbackActions}>
                  <TouchableOpacity
                    style={[styles.copyPromptButton, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => copyPrompt(feedback)}
                  >
                    <Text style={[styles.copyPromptButtonText, { color: colors.text }]}>AI-Prompt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleStatusButton, feedback.status === 'done' && { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => toggleFeedbackStatus(feedback)}
                  >
                    <Text style={[styles.toggleStatusButtonText, feedback.status === 'done' && { color: colors.textSecondary }]}>
                      {feedback.status === 'open' ? 'Erledigt' : 'Öffnen'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteFeedbackButton}
                    onPress={() => deleteFeedback(feedback)}
                  >
                    <Text style={styles.deleteFeedbackButtonText}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      {showConfirmModal && (selectedAdvisor || selectedRequest) && (
        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.confirmModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                {confirmAction === 'makeAdmin' && 'Admin-Rechte vergeben'}
                {confirmAction === 'removeAdmin' && 'Admin-Rechte entfernen'}
                {confirmAction === 'approve' && 'Anfrage genehmigen'}
                {confirmAction === 'reject' && 'Anfrage ablehnen'}
              </Text>
              <Text style={[styles.confirmText, { color: (confirmAction === 'removeAdmin' || confirmAction === 'reject') ? '#ef4444' : colors.textSecondary }]}>
                {confirmAction === 'makeAdmin' && selectedAdvisor &&
                  `Möchten Sie ${selectedAdvisor.first_name} ${selectedAdvisor.last_name} zum Admin machen?`}
                {confirmAction === 'removeAdmin' && selectedAdvisor &&
                  `Möchten Sie ${selectedAdvisor.first_name} ${selectedAdvisor.last_name} die Admin-Rechte entziehen?`}
                {confirmAction === 'approve' && selectedRequest &&
                  `Möchten Sie ${selectedRequest.requester_name} Zugriff auf ${selectedRequest.player_name} gewähren?`}
                {confirmAction === 'reject' && selectedRequest &&
                  `Möchten Sie die Anfrage von ${selectedRequest.requester_name} für ${selectedRequest.player_name} ablehnen?`}
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmCancelBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmActionBtn, (confirmAction === 'removeAdmin' || confirmAction === 'reject') ? { backgroundColor: '#ef4444' } : { backgroundColor: colors.primary }]}
                  onPress={handleConfirmAction}
                >
                  <Text style={[styles.confirmActionText, { color: (confirmAction === 'removeAdmin' || confirmAction === 'reject') ? '#fff' : colors.primaryText }]}>
                    {confirmAction === 'makeAdmin' && 'Bestätigen'}
                    {confirmAction === 'removeAdmin' && 'Entfernen'}
                    {confirmAction === 'approve' && 'Genehmigen'}
                    {confirmAction === 'reject' && 'Ablehnen'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f5f5' },
  containerMobile: { flexDirection: 'column' },
  mainContent: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  backButtonText: { fontSize: 14, color: '#64748b' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  placeholder: { width: 90 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#000' },
  tabText: { fontSize: 15, color: '#666' },
  tabTextActive: { color: '#000', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  loadingText: { padding: 20, textAlign: 'center', color: '#666' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 16 },
  requestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  requestCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, width: 240, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  requestInfo: { flex: 1 },
  requestPlayer: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  requestAdvisor: { fontSize: 12, color: '#64748b', marginTop: 2 },
  requestDate: { fontSize: 10, color: '#94a3b8' },
  requestActions: { flexDirection: 'row', gap: 6 },
  approveButton: { flex: 1, backgroundColor: '#1a1a1a', paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  approveButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rejectButton: { flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  rejectButtonText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  advisorsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  advisorsGridMobile: { flexDirection: 'column' },
  advisorCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, width: '31%', minWidth: 220, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  advisorCardMobile: { width: '100%', minWidth: 0 },
  advisorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  advisorNameSection: { flex: 1 },
  advisorName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  advisorBirthDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  advisorDivider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 10 },
  advisorBottomSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  advisorDetails: { flex: 1 },
  advisorDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  advisorDetailLabel: { fontSize: 11, color: '#9ca3af' },
  advisorDetailValue: { flex: 1 },
  advisorDetailText: { fontSize: 11, color: '#64748b' },
  linkText: { textDecorationLine: 'underline' },
  roleBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  roleAdmin: { backgroundColor: '#000' },
  roleBerater: { backgroundColor: '#0ea5e9' },
  roleBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  makeAdminButton: { backgroundColor: '#1a1a1a', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 3, alignItems: 'center', alignSelf: 'flex-end', marginLeft: 10 },
  makeAdminButtonText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  removeAdminButton: { backgroundColor: '#fef2f2', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 3, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', alignSelf: 'flex-end', marginLeft: 10 },
  removeAdminButtonText: { color: '#dc2626', fontSize: 10, fontWeight: '600' },
  // Feedback Styles
  feedbackCard: { backgroundColor: '#fff', borderRadius: 6, padding: 8, marginBottom: 6, borderWidth: 1, maxWidth: 500 },
  feedbackCardDone: { opacity: 0.6, backgroundColor: '#f9fafb' },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  feedbackHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  feedbackTypeBadge: { paddingVertical: 1, paddingHorizontal: 5, borderRadius: 3 },
  feedbackTypeBug: { backgroundColor: '#fef2f2' },
  feedbackTypeFeature: { backgroundColor: '#f0fdf4' },
  feedbackTypeOther: { backgroundColor: '#f0f9ff' },
  feedbackTypeBadgeText: { fontSize: 9, fontWeight: '600' },
  feedbackScreen: { fontSize: 9, color: '#6b7280' },
  feedbackDescriptionBox: { padding: 6, borderRadius: 4, borderWidth: 1, marginBottom: 6 },
  feedbackDescription: { fontSize: 11, color: '#1f2937', lineHeight: 14 },
  feedbackUser: { fontSize: 9, color: '#9ca3af' },
  feedbackDate: { fontSize: 9, color: '#9ca3af' },
  feedbackActions: { flexDirection: 'row', gap: 4 },
  copyPromptButton: { backgroundColor: '#f3f4f6', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 3, alignItems: 'center' },
  copyPromptButtonText: { fontSize: 10, color: '#374151', fontWeight: '500' },
  toggleStatusButton: { backgroundColor: '#10b981', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 3, alignItems: 'center' },
  toggleStatusButtonDone: { backgroundColor: '#f3f4f6' },
  toggleStatusButtonText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  toggleStatusButtonTextDone: { color: '#6b7280' },
  deleteFeedbackButton: { paddingVertical: 3, paddingHorizontal: 6, borderRadius: 3, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' },
  deleteFeedbackButtonText: { fontSize: 10, color: '#dc2626', fontWeight: '600' },
  // Confirmation Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  confirmModal: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '85%', maxWidth: 320, alignItems: 'center' },
  confirmTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 10 },
  confirmText: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  confirmButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancelBtn: { flex: 1, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  confirmCancelText: { fontSize: 14, fontWeight: '500' },
  confirmActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  confirmActionText: { fontSize: 14, fontWeight: '600' },
});
