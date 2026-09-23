import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { BackChevronIcon, SendIcon } from '../components/Icon';
import { PillButton } from '../components/PillButton';
import { ChatMessage } from '../types/models';
import { getSupportChat, appendSupportChat } from '../storage/supportChat';
import { supportChat } from '../api/client';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from '../constants/support';

type Props = NativeStackScreenProps<RootStackParamList, 'SupportChat'>;

const QUICK_CHIPS = ['My recipes are locked', 'How do I share a recipe?', 'AI features aren\'t working', 'Talk to a real person'];
const REAL_PERSON_CHIP = 'Talk to a real person';
const PHONE_REPLY = `You can reach a real person directly:\n\n📞 ${SUPPORT_PHONE_DISPLAY}\n\nTap below to call.`;

export function SupportChatScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getSupportChat().then(setMessages);
  }, []);

  const send = async (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t || sending) return;
    setDraft('');
    const userMsg: ChatMessage = { role: 'user', text: t };
    const afterUser = await appendSupportChat([userMsg]);
    setMessages(afterUser);

    // Deterministic path — never let the model invent or mangle the number.
    if (t === REAL_PERSON_CHIP) {
      setMessages(await appendSupportChat([{ role: 'ai', text: PHONE_REPLY }]));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    setSending(true);
    try {
      const history = afterUser.slice(-8).map((m) => ({ role: m.role, text: m.text }));
      const res = await supportChat({ message: t, history });
      setMessages(await appendSupportChat([{ role: 'ai', text: res.reply }]));
    } catch (e: any) {
      setMessages(
        await appendSupportChat([
          { role: 'ai', text: `I couldn't reach support chat right now. (${e?.message ?? 'unknown error'}) You can also call ${SUPPORT_PHONE_DISPLAY}.` },
        ]),
      );
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.screenBg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <BackChevronIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Need Help?</Text>
          <Text style={styles.headerStatus}>● UlamHub Support</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesWrap}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => {
          const showCallButton = m.role === 'ai' && m.text.includes(SUPPORT_PHONE_DISPLAY);
          return (
            <View key={i} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <View style={[styles.bubble, { backgroundColor: m.role === 'user' ? colors.deepGreen : colors.white }]}>
                <Text style={{ color: m.role === 'user' ? colors.mint : colors.ink, fontSize: 14, lineHeight: 20, fontFamily: fonts.body }}>
                  {m.text}
                </Text>
              </View>
              {showCallButton && (
                <PillButton
                  label={`📞 Call ${SUPPORT_PHONE_DISPLAY}`}
                  onPress={() => Linking.openURL(SUPPORT_PHONE_TEL)}
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                />
              )}
            </View>
          );
        })}
        {sending && (
          <View style={{ alignItems: 'flex-start' }}>
            <View style={[styles.bubble, { backgroundColor: colors.white }]}>
              <ActivityIndicator color={colors.tealDark} size="small" />
            </View>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4 }}>
          {QUICK_CHIPS.map((c) => (
            <Pressable
              key={c}
              onPress={() => send(c)}
              style={[styles.chip, c === REAL_PERSON_CHIP && styles.chipHighlight]}
            >
              <Text style={[styles.chipText, c === REAL_PERSON_CHIP && styles.chipHighlightText]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Describe what's going on…"
          placeholderTextColor={colors.tertiaryText}
          style={styles.input}
          onSubmitEditing={() => send()}
        />
        <Pressable onPress={() => send()} style={styles.sendBtn}>
          <SendIcon />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  headerStatus: { fontSize: 11.5, color: colors.tealLink, fontFamily: fonts.bodySemiBold },
  messagesWrap: { padding: 18, gap: 12 },
  bubble: { maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(23,137,123,0.35)', backgroundColor: colors.white },
  chipHighlight: { backgroundColor: colors.deepGreen, borderColor: colors.deepGreen },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.mintText },
  chipHighlightText: { color: colors.mint },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, height: 48, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderMuted, backgroundColor: colors.white, paddingHorizontal: 16, fontSize: 14, color: colors.ink },
  sendBtn: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.deepGreen, alignItems: 'center', justifyContent: 'center' },
});
