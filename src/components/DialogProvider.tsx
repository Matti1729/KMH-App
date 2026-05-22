// In-App Confirm/Alert Modals — Ersatz für window.confirm / window.alert.
// Chrome & Edge unterdrücken native confirm() nach wiederholtem Aufruf bzw.
// wenn der User die "weitere Dialoge unterbinden"-Checkbox gesetzt hat;
// der Call gibt dann false zurück ohne den Dialog zu zeigen. Diese Komponente
// rendert stattdessen ein React-Modal, das immer angezeigt wird.
//
// API:
//   const { confirm, alert } = useDialog();
//   const ok = await confirm({ title, message, confirmLabel?, cancelLabel?, danger?, primary? });
//   await alert({ title, message, buttonLabel? });
//
// Designsystem (kmh-design-system):
//   - Modal-Box: bg #1a1a1a, border rgba(255,255,255,0.15), borderRadius 16
//   - Titel: Josefin Sans, fontSize 16, fontWeight 400, letterSpacing 3, uppercase, color rgba(255,255,255,0.7)
//   - Body: fontSize 13, fontWeight 500, color rgba(255,255,255,0.7), zentriert
//   - Button-Standard: height 28, paddingHorizontal 10, borderRadius 6, fontSize 11, fontWeight 600
//   - Primary: bg #22c55e / Text #fff. Danger: bg #dc2626 / border #dc2626 / Text #fff. Cancel: bg rgba(255,255,255,0.08) / border rgba(255,255,255,0.2) / Text rgba(255,255,255,0.85)
import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';

// react-dom nur auf Web laden — auf Native nicht verfügbar.
const reactDomCreatePortal: ((node: any, container: any) => any) | null =
  Platform.OS === 'web' ? (require('react-dom') as any).createPortal : null;

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;     // roter Confirm-Button
  primary?: boolean;    // grüner Confirm-Button (default true wenn weder danger noch primary explizit)
};

type AlertOptions = {
  title: string;
  message?: string;
  buttonLabel?: string;
};

type DialogState =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void }
  | null;

type DialogContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    // Fallback: falls jemand useDialog außerhalb des Providers aufruft, lieber
    // ein No-Op mit window.confirm/alert als Crash — sollte aber nicht passieren.
    return {
      confirm: async (o) => (typeof window !== 'undefined' ? window.confirm(`${o.title}\n\n${o.message || ''}`) : true),
      alert: async (o) => { if (typeof window !== 'undefined') window.alert(`${o.title}\n\n${o.message || ''}`); },
    };
  }
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  // Wir queuen optional sequenziell, falls mehrere Aufrufe kurz hintereinander kommen.
  const queueRef = useRef<DialogState[]>([]);

  const showNext = useCallback(() => {
    setDialog((current) => {
      if (current) return current;
      const next = queueRef.current.shift() || null;
      return next;
    });
  }, []);

  const enqueue = useCallback((d: NonNullable<DialogState>) => {
    queueRef.current.push(d);
    showNext();
  }, [showNext]);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      enqueue({ kind: 'confirm', opts, resolve });
    });
  }, [enqueue]);

  const alert = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      enqueue({ kind: 'alert', opts, resolve });
    });
  }, [enqueue]);

  const close = useCallback((result?: boolean) => {
    setDialog((current) => {
      if (current?.kind === 'confirm') current.resolve(!!result);
      if (current?.kind === 'alert') current.resolve();
      return null;
    });
    // Nächsten Dialog aus der Queue zeigen (in nächstem Tick, damit Modal-Unmount fertig ist)
    setTimeout(() => showNext(), 0);
  }, [showNext]);

  const value: DialogContextValue = { confirm, alert };

  const overlayPositionStyle: any = Platform.OS === 'web'
    ? { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0 }
    : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

  const overlayNode = dialog ? (
    <View
      style={[overlayPositionStyle, styles.overlay, { zIndex: 2147483647, elevation: 999 }]}
      pointerEvents="auto"
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={() => close(false)} />
      <View style={[styles.box, dialog.kind === 'confirm' && dialog.opts.danger ? { borderColor: '#dc2626' } : null]}>
        <Text style={styles.title}>{dialog.opts.title}</Text>
        {dialog.opts.message ? (
          <Text style={styles.message}>{dialog.opts.message}</Text>
        ) : null}

        {dialog.kind === 'confirm' ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={() => close(false)}
            >
              <Text style={styles.btnCancelText}>{dialog.opts.cancelLabel || 'Abbrechen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                dialog.opts.danger ? styles.btnDanger : styles.btnPrimary,
              ]}
              onPress={() => close(true)}
            >
              <Text style={styles.btnConfirmText}>{dialog.opts.confirmLabel || 'OK'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.buttonRow, { justifyContent: 'center' }]}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { minWidth: 120 }]}
              onPress={() => close()}
            >
              <Text style={styles.btnConfirmText}>{(dialog.opts as AlertOptions).buttonLabel || 'OK'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  ) : null;

  // Auf Web: per createPortal direkt an <body> hängen — sonst stapelt RN-Web's Modal
  // (das die Spielerprofil-Sheet rendert) über dem Dialog, weil RN-Modals als separater
  // r-modalRoot mit höherem Stack-Index gemountet werden. Ein direkter document.body-Portal
  // wird IMMER als letztes gerendert und liegt deshalb über allen anderen Portalen.
  return (
    <DialogContext.Provider value={value}>
      {children}
      {Platform.OS === 'web' && reactDomCreatePortal && typeof document !== 'undefined'
        ? reactDomCreatePortal(overlayNode, document.body)
        : overlayNode}
    </DialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // Modal-Card: schwarz statt #1a1a1a (das wirkt im Vergleich zur Overlay grau).
  // Folgt dem Dropdown-Listen-Pattern aus dem Skill ("Niemals #1a1a1a für Listen — immer #000").
  box: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 440,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 24,
  },
  title: {
    fontFamily: 'Josefin Sans',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 19,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  btn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  // Cancel: transparenter Hintergrund + subtiler Rand — kein Grau, folgt dem
  // kmh-design-system "secondary" Style (Borders only, kein Fill).
  btnCancel: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  btnCancelText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  // Primary: vollflächiges KMH-Grün
  btnPrimary: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  // Danger: vollflächiges Rot für endgültige Aktionen (Löschen-Confirm).
  btnDanger: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
