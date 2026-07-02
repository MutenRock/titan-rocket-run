import { clamp } from '../game/constants';

export interface DifficultyState {
  value: number;
  minGap: number;
  maxGap: number;
  minWidth: number;
  maxWidth: number;
  verticalRange: number;
  boostChance: number;
  rampChance: number;
  pathChance: number;
  floatingBoneChance: number;
}

export class DifficultyCurve {
  sample(worldX: number): DifficultyState {
    const value = clamp(worldX / 7600, 0, 1);

    return {
      value,
      minGap: 82 + value * 70,
      maxGap: 218 + value * 112,
      minWidth: 340 - value * 78,
      maxWidth: 740 - value * 135,
      verticalRange: 36 + value * 74,
      boostChance: 0.12 + value * 0.04,
      rampChance: 0,
      pathChance: Math.max(0.16, 0.28 - value * 0.08),
      floatingBoneChance: 0.16 + value * 0.14,
    };
  }
}
