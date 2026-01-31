// Food-focused palette: warm orange primary, clean whites
const primaryOrange = "#E85D04";
const primaryOrangeLight = "#F48C06";
const tintColorLight = primaryOrange;
const tintColorDark = primaryOrangeLight;

export default {
  light: {
    text: "#1a1a1a",
    background: "#fff",
    tint: tintColorLight,
    tabIconDefault: "#999",
    tabIconSelected: tintColorLight,
    primary: primaryOrange,
    primaryLight: primaryOrangeLight,
  },
  dark: {
    text: "#f5f5f5",
    background: "#121212",
    tint: tintColorDark,
    tabIconDefault: "#888",
    tabIconSelected: tintColorDark,
    primary: primaryOrangeLight,
    primaryLight: primaryOrange,
  },
};
