# ADAFontCheck
Determines if a font meets American Disability Association Sign Requirements

<img>

ADAFontCheck uses opentype.js to analyze font glyphs to determine if the font metrics meet American Disablity Association.

### ADA Requirements
#### Stroke Width Ratio: **20% - 30%**
#### Body Width Ratio: **60% - 100%**

## How it Works
### Stroke Width
1. The letter 'I' is used to determine stroke width.
2. The highest and lowest x and y values are used to deterine height and width.
3. If the letter is serifed, the 2nd highest and lowest x-values are used.
4. Compared against ADA standards. (

### Height/Width Ratio
1. The letter 'H' and 'O' are used to determine the height/width ratio.
