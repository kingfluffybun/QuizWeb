/**
 * Avatar background color palette for user accounts
 */
export const AVATAR_COLOR_PALETTE = [
    "#FFB3BA", 
    "#FFBFB3", 
    "#FFCBB3", 
    "#FFD8B3", 
    "#FFE5B3", 
    "#FFF2B3", 
    "#FDFFB3", 
    "#E8F8B3", 
    "#D3F5B3", 
    "#BFF2B8", 
    "#B3F0C8", 
    "#B3EEDA", 
    "#B3ECEC", 
    "#B3E0F5", 
    "#B3D3FA", 
    "#B3C6FF", 
    "#BFB8FF", 
    "#CDB8FF", 
    "#DBB8FF", 
    "#E8B8FF", 
    "#F3B8F5",
    "#FFB8E6",
    "#FFB8D3",
    "#FFB8C6"
] as const;

/**
 * Gets a random color from the avatar palette
 * @returns A random hex color string from the palette
 */
export function getRandomPaletteColor(): string {
    const randomIndex = Math.floor(Math.random() * AVATAR_COLOR_PALETTE.length);
    return AVATAR_COLOR_PALETTE[randomIndex];
}

/**
 * Gets all colors from the palette
 */
export function getAvatarColorPalette(): readonly string[] {
    return AVATAR_COLOR_PALETTE;
}