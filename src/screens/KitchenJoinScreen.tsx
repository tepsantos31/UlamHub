import React, { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/theme';
import { lookupKitchenByCode, requestJoinKitchenById } from '../lib/kitchen';

type Props = NativeStackScreenProps<RootStackParamList, 'KitchenJoin'>;

/** Not a real screen — the landing target for a tapped kitchen invite link
 * (ulamhub://kitchen/join?code=XXXX). Looks the kitchen up, confirms with
 * the user, then sends a join request — the owner still has to approve it. */
export function KitchenJoinScreen({ route, navigation }: Props) {
  const code = route.params?.code;

  useEffect(() => {
    (async () => {
      if (!code) {
        navigation.replace('Kitchen');
        return;
      }
      try {
        const found = await lookupKitchenByCode(code);
        Alert.alert('Request to join', `Ask to join "${found.name}"? The owner will need to approve it first.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.replace('Kitchen') },
          {
            text: 'Request to join',
            onPress: async () => {
              try {
                await requestJoinKitchenById(found.id);
                Alert.alert('Request sent', `We'll let you know once ${found.name} approves it.`);
              } catch (e: any) {
                Alert.alert('Could not send request', e?.message ?? 'Something went wrong.');
              } finally {
                navigation.replace('Kitchen');
              }
            },
          },
        ]);
      } catch (e: any) {
        Alert.alert('Could not find that kitchen', e?.message ?? 'The invite link may be invalid.');
        navigation.replace('Kitchen');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenBg }}>
      <ActivityIndicator color={colors.tealDark} />
    </View>
  );
}
