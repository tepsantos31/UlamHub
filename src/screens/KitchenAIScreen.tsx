import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { BackChevronIcon, SendIcon } from '../components/Icon';
import { RecipeCard } from '../components/RecipeCard';
import { PremiumGate } from '../components/PremiumGate';
import { ChatMessage, Recipe, SettingsState } from '../types/models';
import { getChat, appendChat, clearChat } from '../storage/chat';
import { listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { chatMessage } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'KitchenAI'>;

const QUICK_CHIP_KEYS = ['haveChickenLime', 'planMyWeek', 'makeAdoboVegan', 'snackIdeas'];

// Very simple local matcher — the backend never needs the user's full recipe
// library, it just replies conversationally; we resolve a recipe-card mention
// against `uh_recipes` on-device.
function findMentionedRecipe(reply: string, recipes: Recipe[]): Recipe | undefined {
  const lower = reply.toLowerCase();
  return recipes.find((r) => lower.includes(r.name.toLowerCase()));
}

export function KitchenAIScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [draft, setDraft] = useState(route.params?.prefill ?? '');
  const [sending, setSending] = useState(false);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [c, r, s] = await Promise.all([getChat(), listRecipes(), getSettings()]);
      setMessages(c);
      setRecipes(r);
      setSettingsState(s);
    })();
  }, []);

  // A remix chip on Recipe Detail navigates here with a prefill — it's meant
  // to ask the question right away, not just drop text in the input box for
  // the user to notice and send themselves.
  useEffect(() => {
    if (autoSentRef.current || !route.params?.prefill || !settings) return;
    if (!isSubscriptionActive(settings)) return; // the paywall shows instead; nothing to send to
    autoSentRef.current = true;
    send(route.params.prefill);
  }, [route.params?.prefill, settings, recipes]);

  const send = async (text?: string) => {
    const message = (text ?? draft).trim();
    if (!message || sending) return;
    setDraft('');
    const userMsg: ChatMessage = { role: 'user', text: message };
    const afterUser = await appendChat([userMsg]);
    setMessages(afterUser);
    setSending(true);
    try {
      const history = afterUser.slice(-8).map((m) => ({ role: m.role, text: m.text }));
      const res = await chatMessage({
        message,
        history,
        context: { recipeNames: recipes.map((r) => r.name) },
      });
      const mentioned = findMentionedRecipe(res.reply, recipes);
      const aiMsg: ChatMessage = { role: 'ai', text: res.reply, recipeId: mentioned?.id };
      const afterAi = await appendChat([aiMsg]);
      setMessages(afterAi);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        role: 'ai',
        text: t('kitchenAI.unreachableError', { message: e?.message ?? t('kitchenAI.unknownError') }),
      };
      setMessages(await appendChat([errMsg]));
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const onClearChat = () => {
    if (messages.length === 0) return;
    Alert.alert(t('kitchenAI.alerts.clearChatTitle'), t('kitchenAI.alerts.clearChatBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mealPlanner.clear'),
        style: 'destructive',
        onPress: async () => {
          const next = await clearChat();
          setMessages(next);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.screenBg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <BackChevronIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('kitchenAI.title')}</Text>
          <Text style={styles.headerStatus}>● {t('kitchenAI.readyToHelp')}</Text>
        </View>
        <Pressable onPress={onClearChat} style={styles.clearChatBtn}>
          <Text style={styles.clearChatText}>{t('kitchenAI.clearChat')}</Text>
        </Pressable>
      </View>

      {settings && !isSubscriptionActive(settings) ? (
        <ScrollView contentContainerStyle={styles.messagesWrap}>
          <PremiumGate
            icon="✨"
            title={t('kitchenAI.premiumToolTitle')}
            body={t('kitchenAI.premiumToolBody')}
            onGoPremium={() => navigation.navigate('Paywall')}
          />
        </ScrollView>
      ) : (
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesWrap}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => {
          const recipe = m.recipeId ? recipes.find((r) => r.id === m.recipeId) : undefined;
          return (
            <View key={i} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <View style={[styles.bubble, { backgroundColor: m.role === 'user' ? colors.deepGreen : colors.white }]}>
                <Text style={{ color: m.role === 'user' ? colors.mint : colors.ink, fontSize: 14, lineHeight: 20, fontFamily: fonts.body }}>
                  {m.text}
                </Text>
              </View>
              {recipe && (
                <View style={{ marginTop: 8 }}>
                  <RecipeCard recipe={recipe} width={230} onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id })} />
                </View>
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
          {QUICK_CHIP_KEYS.map((key) => (
            <Pressable key={key} onPress={() => send(t(`kitchenAI.quickChips.${key}`))} style={styles.chip}>
              <Text style={styles.chipText}>{t(`kitchenAI.quickChips.${key}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
      )}

      {settings && isSubscriptionActive(settings) && (
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('kitchenAI.askAnything')}
          placeholderTextColor={colors.tertiaryText}
          style={styles.input}
          onSubmitEditing={() => send()}
        />
        <Pressable onPress={() => send()} style={styles.sendBtn}>
          <SendIcon />
        </Pressable>
      </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  headerStatus: { fontSize: 11.5, color: colors.tealLink, fontFamily: fonts.bodySemiBold },
  clearChatBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderMuted },
  clearChatText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.secondaryText },
  messagesWrap: { padding: 18, gap: 12 },
  bubble: { maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(23,137,123,0.35)', backgroundColor: colors.white },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.mintText },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, height: 48, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderMuted, backgroundColor: colors.white, paddingHorizontal: 16, fontSize: 14, color: colors.ink },
  sendBtn: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.deepGreen, alignItems: 'center', justifyContent: 'center' },
});
