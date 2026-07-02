import alea from 'alea';
import { createNoise2D } from 'simplex-noise';
import { GROUND_Y, clamp } from '../game/constants';
import type { EntityDraft, ObstacleEntityKind, PlatformData, PlatformKind } from '../types/game';
import { DifficultyCurve } from './DifficultyCurve';

const BIOME_SPAN = 2200;
const BIOME_OBSTACLES: { signature: ObstacleEntityKind; pool: ObstacleEntityKind[] }[] = [
  { signature: 'seagull', pool: ['seagull', 'gust', 'cable', 'seagull'] },
  { signature: 'gust', pool: ['gust', 'menhir', 'seagull', 'gust'] },
  { signature: 'menhir', pool: ['menhir', 'gust', 'cable', 'menhir'] },
  { signature: 'cable', pool: ['cable', 'granny', 'seagull', 'cable'] },
];

export class PlatformGenerator {
  private readonly random: () => number;
  private readonly noise2D: (x: number, y: number) => number;

  constructor(
    seed: string | number,
    private readonly curve = new DifficultyCurve(),
  ) {
    this.random = alea(seed);
    this.noise2D = createNoise2D(this.random);
  }

  nextPlatform(previous: PlatformData, id: number): PlatformData {
    const difficulty = this.curve.sample(previous.x + previous.w);
    const kind = this.pickKind(difficulty, id);
    const gap = this.lerp(difficulty.minGap, difficulty.maxGap, this.random());
    const baseWidth = this.lerp(difficulty.minWidth, difficulty.maxWidth, this.random());
    const width = this.getWidth(baseWidth, difficulty.value, kind);
    const noise = this.noise2D(id * 0.23, 0.4);
    const stepPressure = id > 8 && id % 5 === 0 ? 32 + difficulty.value * 42 : 0;
    const routeSeparation = kind === 'path' ? 54 : 0;
    const rawY = clamp(
      previous.y + noise * difficulty.verticalRange + (this.random() - 0.5) * 34,
      GROUND_Y - 230,
      GROUND_Y - 42,
    );
    const y = this.getRouteY(rawY, previous.y, kind);

    return {
      id,
      x: previous.x + previous.w + gap + stepPressure + routeSeparation,
      y,
      w: width,
      h: kind === 'path' ? 28 + this.random() * 10 : kind === 'ramp' ? 48 + this.random() * 16 : 34 + this.random() * 18,
      kind,
    };
  }

  decorate(platform: PlatformData): EntityDraft[] {
    const difficulty = this.curve.sample(platform.x);
    const entities: EntityDraft[] = [];
    const boneCount =
      platform.kind === 'bonus'
        ? 5 + Math.floor(this.random() * 2)
        : platform.kind === 'path'
          ? 4 + Math.floor(this.random() * 3)
          : difficulty.value < 0.22
            ? 2 + Math.floor(this.random() * 2)
            : 1 + Math.floor(this.random() * 3);

    for (let i = 0; i < boneCount; i += 1) {
      const floating =
        platform.kind === 'bonus'
          ? true
          : this.random() < (platform.kind === 'path' ? difficulty.floatingBoneChance * 0.58 : difficulty.floatingBoneChance);
      entities.push({
        type: 'bone',
        x: platform.x + 55 + this.random() * Math.max(60, platform.w - 110),
        y: platform.y - (floating ? 118 + this.random() * (platform.kind === 'bonus' ? 44 : 72) : 62),
        r: 19,
        value: platform.kind === 'bonus' ? 7 : floating ? 5 : 3,
        bob: this.random() * Math.PI * 2,
      });
    }

    const obstacle = this.createObstacle(platform, difficulty.value);
    if (obstacle) {
      entities.push(obstacle);
    }

    return entities;
  }

  createBonusBranch(platform: PlatformData, id: number): PlatformData | undefined {
    const difficulty = this.curve.sample(platform.x);
    if (platform.id < 4 || platform.kind === 'boost' || platform.kind === 'ramp' || platform.w < 340) {
      return undefined;
    }

    const chance = 0.27 + difficulty.value * 0.13 + (platform.kind === 'path' ? 0.11 : 0);
    if (this.random() > chance) {
      return undefined;
    }

    const maxWidth = Math.max(210, Math.min(340, platform.w - 136));
    const width = clamp(platform.w * (0.42 + this.random() * 0.14), 210, maxWidth);
    const maxOffset = Math.max(84, platform.w - width - 36);
    return {
      id,
      x: platform.x + clamp(platform.w * (0.18 + this.random() * 0.32), 84, maxOffset),
      y: clamp(platform.y - 155 - this.random() * 78, GROUND_Y - 305, GROUND_Y - 122),
      w: width,
      h: 22 + this.random() * 6,
      kind: 'bonus',
    };
  }

  private lerp(min: number, max: number, ratio: number): number {
    return min + (max - min) * ratio;
  }

  private pickKind(difficulty: ReturnType<DifficultyCurve['sample']>, id: number): PlatformKind {
    if (id < 2) {
      return 'normal';
    }

    const roll = this.random();
    if (roll < difficulty.boostChance) {
      return 'boost';
    }

    if (roll < difficulty.boostChance + difficulty.rampChance) {
      return 'ramp';
    }

    if (roll < difficulty.boostChance + difficulty.rampChance + difficulty.pathChance) {
      return 'path';
    }

    return 'normal';
  }

  private getWidth(baseWidth: number, difficulty: number, kind: PlatformKind): number {
    if (kind === 'path') {
      return clamp(baseWidth * 1.42 + 150, 360, 720 - difficulty * 130);
    }

    if (kind === 'ramp') {
      return clamp(baseWidth * 1.12 + 72, 230, 510 - difficulty * 80);
    }

    return baseWidth;
  }

  private getRouteY(rawY: number, previousY: number, kind: PlatformKind): number {
    if (kind === 'path') {
      return clamp(previousY + (this.random() - 0.5) * 38, GROUND_Y - 220, GROUND_Y - 38);
    }

    if (kind === 'ramp') {
      return clamp(rawY + 20 + this.random() * 28, GROUND_Y - 220, GROUND_Y - 44);
    }

    return rawY;
  }

  private createObstacle(platform: PlatformData, difficulty: number): EntityDraft | undefined {
    if (platform.id < 4 || platform.w < 270 || platform.kind === 'boost' || platform.kind === 'ramp' || platform.kind === 'bonus') {
      return undefined;
    }

    const forceSignature = this.shouldForceSignature(platform);
    const chance = (platform.kind === 'path' ? 0.3 : 0.2) + difficulty * 0.16;
    if (!forceSignature && this.random() > chance) {
      return undefined;
    }

    const type = this.pickObstacleType(platform.x, forceSignature);
    const x = platform.x + clamp(platform.w * (0.34 + this.random() * 0.36), 96, platform.w - 88);
    const bob = this.random() * Math.PI * 2;

    switch (type) {
      case 'seagull':
        return {
          type,
          x,
          y: platform.y - 126 - this.random() * 54,
          r: 28,
          value: 0,
          bob,
        };
      case 'cable':
        return {
          type,
          x,
          y: platform.y - 18,
          r: 26,
          value: 0,
          bob,
        };
      case 'granny':
        return {
          type,
          x,
          y: platform.y - 47,
          r: 30,
          value: 0,
          bob,
        };
      case 'menhir':
        return {
          type,
          x,
          y: platform.y - 62,
          r: 34,
          value: 0,
          bob,
        };
      case 'gust':
      default:
        return {
          type: 'gust',
          x,
          y: platform.y - 108 - this.random() * 36,
          r: 34,
          value: 0,
          bob,
        };
    }
  }

  private shouldForceSignature(platform: PlatformData): boolean {
    if (platform.id < 7) {
      return false;
    }

    const positionInBiome = Math.max(0, platform.x) % BIOME_SPAN;
    return platform.id % 9 === 0 || (positionInBiome > 320 && positionInBiome < 620);
  }

  private pickObstacleType(worldX: number, forceSignature: boolean): ObstacleEntityKind {
    const biome = Math.floor(Math.max(0, worldX) / BIOME_SPAN) % BIOME_OBSTACLES.length;
    const config = BIOME_OBSTACLES[biome];
    if (forceSignature) {
      return config.signature;
    }

    const pool = config.pool;
    return pool[Math.floor(this.random() * pool.length)];
  }
}
