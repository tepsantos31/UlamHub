import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Recipe } from '../types/models';
import { PlaceholderImage } from './PlaceholderImage';
import { HeartIcon } from './Icon';

interface Props {
  recipe: Recipe;
  onPress: () => void;
  width?: number;
  imageHeight?: number;
  locked?: boolean;
}

export function RecipeCard({ recipe, onPress, width = 180, imageHeight = 120, locked = false }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { width }, shadow.card]}>
      <View style={{ height: imageHeight, overflow: 'hidden' }}>
        <PlaceholderImage uri={recipe.photoUri} source={recipe.photoAsset} style={StyleSheet.absoluteFill} />
        <View style={styles.regionBadge}>
          <Text style={styles.regionBadgeText}>{recipe.country}</Text>
        </View>
        {locked && (
          <View style={styles.lockBadge}>
            <Text style={{ fontSize: 12 }}>🔒</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {recipe.name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>⏱ {recipe.time}m</Text>
          <Text style={styles.meta}>★ {recipe.rating}</Text>
          <Text style={styles.meta}>{recipe.budget}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function TrendingCard({
  recipe,
  onPress,
  locked = false,
  shareCount,
}: {
  recipe: Recipe;
  onPress: () => void;
  locked?: boolean;
  shareCount?: number;
}) {
  return (
    <Pressable onPress={onPress} style={styles.trendingCard}>
      <PlaceholderImage uri={recipe.photoUri} source={recipe.photoAsset} style={StyleSheet.absoluteFill} />
      <View style={styles.trendingScrim} />
      {locked ? (
        <View style={styles.trendingHeart}>
          <Text style={{ fontSize: 14 }}>🔒</Text>
        </View>
      ) : (
        <View style={styles.trendingHeart}>
          <HeartIcon size={16} />
        </View>
      )}
      {shareCount != null && shareCount > 0 && (
        <View style={styles.trendingShareBadge}>
          <Text style={styles.trendingShareBadgeText}>🔗 {shareCount}</Text>
        </View>
      )}
      <View style={styles.trendingTextWrap}>
        <Text style={styles.trendingName}>{recipe.name}</Text>
        <Text style={styles.trendingSub}>
          {recipe.country} · by {recipe.author}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  regionBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    backgroundColor: 'rgba(14,59,57,0.82)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  regionBadgeText: {
    color: colors.mint,
    fontSize: 10,
    fontFamily: fonts.bodyBold,
  },
  lockBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 13,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
  },
  meta: {
    fontSize: 11.5,
    fontFamily: fonts.bodySemiBold,
    color: colors.secondaryText,
  },
  trendingCard: {
    width: 230,
    height: 150,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  trendingScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,25,12,0.4)',
  },
  trendingHeart: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingShareBadge: {
    position: 'absolute',
    top: 11,
    left: 11,
    backgroundColor: 'rgba(14,59,57,0.82)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendingShareBadgeText: {
    color: colors.mint,
    fontSize: 10.5,
    fontFamily: fonts.bodyBold,
  },
  trendingTextWrap: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    right: 14,
  },
  trendingName: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.white,
  },
  trendingSub: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 3,
    fontFamily: fonts.bodySemiBold,
  },
});
