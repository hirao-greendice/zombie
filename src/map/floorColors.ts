// 階ごとの壁・床の色。複数の階を表示したときに、どの線がどの階かを見分けるため。
// 黄(出入口)・青(階段)・赤(ゾンビ)・白(仲間)とかぶらない色にしている
// 1F = 緑 / 2F = 紫 / 3F = 青緑
const FLOOR_COLORS = [0x3dffa2, 0xb48cff, 0x2ee8d6]

/** 階の index から色(0xRRGGBB)。4階以上は先頭から繰り返す */
export const floorColor = (index: number) => FLOOR_COLORS[index % FLOOR_COLORS.length]

/** CSS 用の '#rrggbb' */
export const floorColorCss = (index: number) => `#${floorColor(index).toString(16).padStart(6, '0')}`
