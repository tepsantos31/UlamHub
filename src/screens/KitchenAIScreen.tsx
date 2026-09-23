import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { BackChevronIcon, SendIcon } from '../components/Icon';
import { RecipeCard } from '../components/RecipeCard';
import { PremiumGate } from '../components/PremiumGate';
import { ChatMessage, Recipe, SettingsState } from '../types/models';
import { getChat, appendChat } from '../storage/chat';
import { listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { chatMessage } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'KitchenAI'>;

const QUICK_CHIPS = ['I have chicken & lime', 'Plan my week for $80', 'Make adobo vegan', 'Snack ideas'];

// Very simple local matcher — the backend never needs the user's full recipe
// library, it just replies conversationally; we resolve a recipe-card mention
// against `uh_recipes` on-device.
function findMentionedRecipe(reply: string, recipes: Recipe[]): Recipe | undefined {
  const lower = reply.toLowerCase();
  return recipes.find((r) => lower.includes(r.name.toLowerCase()));
}

export function KitchenAIScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [draft, setDraft] = useState(route.params?.prefill ?? '');
  const [sending, setSending] = useState(false);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const [c, r, s] = await Promise.all([getChat(), listRecipes(), getSettings()]);
      setMessages(c);
      setRecipes(r);
      setSettingsState(s);
    })();
  }, []);

  const send = async (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t || sending) return;
    setDraft('');
    const userMsg: ChatMessage = { role: 'user', text: t };
    const afterUser = await appendChat([userMsg]);
    setMessages(afterUser);
    setSending(true);
    try {
      const history = afterUser.slice(-8).map((m) => ({ role: m.role, text: m.text }));
      const res = await chatMessage({
        message: t,
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
        text: `I couldn't reach the Kitchen AI backend. Make sure the server is running and your phone is on the same Wi-Fi. (${e?.message ?? 'unknown error'})`,
      };
      setMessages(await appendChat([errMsg]));
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
          <Text style={styles.headerTitle}>Kitchen AI</Text>
          <Text style={styles.headerStatus}>● Ready to help</Text>
        </View>
      </View>

      {settings && !isSubscriptionActive(settings) ? (
        <ScrollView contentContainerStyle={styles.messagesWrap}>
          <PremiumGate
            icon="✨"
            title="Kitchen AI is a Premium tool"
            body="Chatting with your cooking assistant is a Premium feature — subscribe to UlamHub Premium to unlock it."
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
          {QUICK_CHIPS.map((c) => (
            <Pressable key={c} onPress={() => send(c)} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
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
          placeholder="Ask anything — text or voice…"
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
  messagesWrap: { padding: 18, gap: 12 },
  bubble: { maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(23,137,123,0.35)', backgroundColor: colors.white },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.mintText },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, height: 48, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderMuted, backgroundColor: colors.white, paddingHorizontal: 16, fontSize: 14, color: colors.ink },
  sendBtn: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.deepGreen, alignItems: 'center', justifyContent: 'center' },
});
