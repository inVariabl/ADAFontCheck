export function deriveFontMetadataFromFilename(filename) {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const styleMatch = baseName.match(
    /-(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black|Italic|BoldItalic|LightItalic|MediumItalic|SemiBoldItalic|ExtraBoldItalic|ExtraLightItalic|BlackItalic)$/i
  );

  if (!styleMatch) {
    return { name: baseName, weight: 'Regular' };
  }

  const rawWeight = styleMatch[1];
  const family = baseName.slice(0, -styleMatch[0].length) || baseName;
  const weight = rawWeight.replace(/([a-z])([A-Z])/g, '$1 $2');

  return {
    name: `${family.replace(/([a-z])([A-Z])/g, '$1 $2')} ${weight}`.trim(),
    weight
  };
}
