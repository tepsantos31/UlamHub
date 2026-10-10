import React, { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/theme';
import { lookupKitchenByCode, requestJoinKitchenById } from '../lib/kitchen';

type Props = NativeStackScreenProps<RootStackParamList, 'KitchenJoin'>;

/** Not a real screen — the landing target for a tapped kitchen invite link
 * (ulamhub://kitchen/join?code=XXXX). Looks the kitchen up, confirms with
 * the user, then sends a join request — the owner still has to approve it. */
export function KitchenJoinScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const code = route.params?.code;

  useEffect(() => {
    (async () => {
      if (!code) {
        navigation.replace('Kitchen');
        return;
      }
      try {
        const found = await lookupKitchenByCode(code);
        Alert.alert(t('kitchenJoin.requestToJoinTitle'), t('kitchenJoin.requestToJoinBody', { name: found.name }), [
          { text: t('common.cancel'), style: 'cancel', onPress: () => navigation.replace('Kitchen') },
          {
            text: t('kitchen.requestToJoin'),
            onPress: async () => {
              try {
                await requestJoinKitchenById(found.id);
                Alert.alert(t('kitchen.alerts.requestSentTitle'), t('kitchen.alerts.requestSentBody', { name: found.name }));
              } catch (e: any) {
                Alert.alert(t('kitchen.alerts.couldNotSendRequestTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
              } finally {
                navigation.replace('Kitchen');
              }
            },
          },
        ]);
      } catch (e: any) {
        Alert.alert(t('kitchenJoin.notFoundTitle'), e?.message ?? t('kitchenJoin.notFoundBody'));
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
