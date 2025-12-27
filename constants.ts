
import { ZoneConfig, Card } from './types';

export const MAX_SCORE = 50;
export const EVENT_INTERVAL_ROUNDS = 3;

export const ZONES: Record<string, ZoneConfig> = {
  AFFLUENT: { 
    id: 'affluent', 
    name: '富裕區', 
    color: 'text-purple-600 bg-purple-100', 
    initial: { water: 3, green: 3, material: 3 }, 
    production: { water: 1, green: 1, material: 1 }, 
    desc: '資源豐富，抗災能力強。' 
  },
  BUFFER: { 
    id: 'buffer', 
    name: '緩衝區', 
    color: 'text-blue-600 bg-blue-100', 
    initial: { water: 2, green: 2, material: 2 },
    production: { water: 1, green: 0, material: 1 }, 
    desc: '資源尚可，位置適中。' 
  },
  LOWLYING: { 
    id: 'lowlying', 
    name: '低漥區', 
    color: 'text-stone-600 bg-stone-200', 
    initial: { water: 1, green: 1, material: 1 },
    production: { water: 1, green: 0, material: 0 }, 
    desc: '資源匱乏，易受極端氣候衝擊。' 
  }
};

export const RAW_CARDS: Omit<Card, 'uuid' | 'maxHp'>[] = [
  { id: 'build_shelter', type: 'build', name: '簡易庇護所', cost: { material: 3 }, score: 5, resilience: 3, hp: 3, desc: '提供基礎遮蔽。' },
  { id: 'energy_house', type: 'build', name: '節能綠建築', cost: { material: 3, green: 1 }, score: 8, resilience: 5, hp: 4, desc: '隔熱且節能的高級住宅。' },
  { id: 'social_housing', type: 'build', name: '共居住宅', cost: { material: 2, water: 1 }, score: 6, resilience: 3, hp: 3, desc: '強調通風的社會住宅。' },
  { id: 'plant_tree', type: 'adaptation', name: '種植喬木', cost: { green: 2, water: 1 }, score: 3, resilience: 2, hp: 2, desc: '增加綠覆率，自然降溫。' },
  { id: 'wind_corridor', type: 'adaptation', name: '留設風廊', cost: { material: 2, green: 2 }, score: 7, resilience: 4, hp: 3, desc: '讓路給風走，帶走城市廢熱。' },
  { id: 'water_system', type: 'adaptation', name: '透水鋪面', cost: { material: 1, water: 2 }, score: 4, resilience: 3, hp: 3, desc: '海綿城市概念，調節地表溫度。' },
  { id: 'green_roof', type: 'adaptation', name: '綠屋頂', cost: { green: 2, material: 1 }, score: 5, resilience: 3, hp: 2, desc: '屋頂隔熱，減少室內空調需求。' },
  { id: 'arcade', type: 'adaptation', name: '騎樓設計', cost: { material: 2 }, score: 4, resilience: 4, hp: 4, desc: '提供行人遮蔭涼適的空間。' },
  { id: 'mist_spray', type: 'adaptation', name: '智慧噴霧', cost: { water: 3 }, score: 3, resilience: 2, hp: 1, desc: '利用水霧蒸發快速降溫。' },
  { id: 'ac_unit', type: 'action', name: '安裝空調', cost: { material: 2 }, score: 4, resilience: 1, hp: 2, desc: '立即舒適但排放廢熱(環境升溫)。', effect: 'heat_up' },
  { id: 'sponge_city', type: 'adaptation', name: '海綿城市設施', cost: { material: 2, water: 3 }, score: 9, resilience: 6, hp: 5, desc: '極高韌性的水循環系統。' },
  { id: 'district_cooling', type: 'adaptation', name: '區域冷卻系統', cost: { material: 4, green: 2 }, score: 12, resilience: 7, hp: 6, desc: '大型基礎設施，有效對抗極端熱浪。' },
];

export const CLIMATE_EVENTS = [
  { id: 'heatwave', name: '極端熱浪', intensity: 6, targets: ['affluent', 'buffer', 'lowlying'], desc: '強度 6。韌性不足將受損。' },
  { id: 'typhoon', name: '強烈颱風', intensity: 8, targets: ['lowlying', 'buffer'], desc: '強度 8。狂風暴雨。' },
  { id: 'foehn', name: '焚風侵襲', intensity: 5, targets: ['lowlying'], desc: '強度 5。乾熱焚風。' },
];
