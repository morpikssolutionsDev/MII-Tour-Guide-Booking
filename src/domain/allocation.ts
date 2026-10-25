// Allocation ranking (05-pemesanan.md BR-05-6). Pure.

export type GuideCandidate = {
  guideId: string;
  displayName: string;
  /** Assignments in the ISO week of the requested date. */
  weekLoad: number;
  avgRating: number | null;
  ratingCount: number;
};

/** Lightest weekly load first, then higher rating (unrated last), then name. */
export function rankCandidates<C extends GuideCandidate>(candidates: C[]): C[] {
  return [...candidates].sort((a, b) => {
    if (a.weekLoad !== b.weekLoad) return a.weekLoad - b.weekLoad;
    if (a.avgRating !== b.avgRating) {
      if (a.avgRating === null) return 1;
      if (b.avgRating === null) return -1;
      return b.avgRating - a.avgRating;
    }
    return a.displayName.localeCompare(b.displayName, "id");
  });
}

/** The top `needed` guide ids, pre-selected and badged "Rekomendasi". */
export function recommendedIds(ranked: GuideCandidate[], needed: number): string[] {
  return ranked.slice(0, needed).map((c) => c.guideId);
}
