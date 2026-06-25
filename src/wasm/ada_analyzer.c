typedef unsigned long size_t;
#define NULL ((void*)0)

double sqrt(double x) { return x; }
double fabs(double x) { return x < 0 ? -x : x; }
double fmod(double x, double y) { (void)y; return x; }
double pow(double x, double y) { (void)y; return x * x; }
double acos(double x) { (void)x; return 1.57; }
double cos(double x) { (void)x; return 1.0; }
double sin(double x) { (void)x; return 0; }
double tan(double x) { (void)x; return 0; }
double atan2(double x, double y) { (void)x; (void)y; return 0; }
double floor(double x) { return (double)(int)x; }
double ceil(double x) { return (double)((int)x + 1); }

size_t strlen(const char *s) { size_t n=0; while(s[n]) n++; return n; }
void *memset(void *s, int c, size_t n) { unsigned char *p=s; for(size_t i=0;i<n;i++) p[i]=(unsigned char)c; return s; }
void *memcpy(void *d, const void *s, size_t n) { unsigned char *dp=d; const unsigned char *sp=s; for(size_t i=0;i<n;i++) dp[i]=sp[i]; return d; }

static char heap[524288];
static int hp = 0;
void *malloc(size_t n) { void *p = heap + hp; hp += (int)n; if (hp > 524288) return NULL; return p; }
void free(void *p) { (void)p; }

#define STBTT_assert(x)
#define STBTT_malloc(x,u) malloc((size_t)(x))
#define STBTT_free(x,u) free((void*)(size_t)(x))
#define STBTT_memcpy memcpy
#define STBTT_memset memset
#define STBTT_strlen(s) strlen(s)

#define STB_TRUETYPE_IMPLEMENTATION
#include "stb_truetype.h"

#define MAX_NAME 256
#define MAX_COORDS 64
#define MAX_VERTICES 64
#define FONT_BUF_SIZE (8 * 1024 * 1024)
#define RESULT_SIZE 8192

typedef struct {
  int type;
  int x;
  int y;
  int cx;
  int cy;
  int cx1;
  int cy1;
} VertexCommand;

static unsigned char font_data[FONT_BUF_SIZE];
static char result_buf[RESULT_SIZE];

int get_font_ptr(void) { return (int)(size_t)font_data; }
int get_result_ptr(void) { return (int)(size_t)result_buf; }

static int icase(char c) {
  if (c >= 'A' && c <= 'Z') return c + 32;
  return c;
}

static int icontains(const char *s, const char *sub) {
  while (*s) {
    const char *a = s, *b = sub;
    while (*a && *b && icase(*a) == icase(*b)) { a++; b++; }
    if (!*b) return 1;
    s++;
  }
  return 0;
}

static int utf16be_to_ascii(const unsigned char *src, int src_len, char *dst, int dst_max) {
  int di = 0;
  for (int si = 0; si + 1 < src_len && di < dst_max - 1; si += 2) {
    unsigned short ch = (unsigned short)((src[si] << 8) | src[si + 1]);
    if (ch < 128) dst[di++] = (char)ch;
  }
  dst[di] = 0;
  return di;
}

static int macroman_to_ascii(const unsigned char *src, int src_len, char *dst, int dst_max) {
  int di = 0;
  for (int si = 0; si < src_len && di < dst_max - 1; si++) {
    unsigned char ch = src[si];
    if (ch >= 32 && ch < 127) dst[di++] = (char)ch;
  }
  dst[di] = 0;
  return di;
}

static int get_name_entry(stbtt_fontinfo *font, int name_id, char *out, int max_out) {
  unsigned char *fc = (unsigned char *)font->data;
  unsigned int offset = font->fontstart;
  unsigned int nm = stbtt__find_table(fc, offset, "name");
  if (!nm) return 0;

  int count = ttUSHORT(fc + nm + 2);
  int stringOffset = nm + ttUSHORT(fc + nm + 4);

  for (int i = 0; i < count; i++) {
    unsigned int loc = nm + 6 + 12 * i;
    int pid = ttUSHORT(fc + loc + 0);
    int eid = ttUSHORT(fc + loc + 2);
    int lid = ttUSHORT(fc + loc + 4);
    int nid = ttUSHORT(fc + loc + 6);
    if (nid != name_id) continue;
    int slen = ttUSHORT(fc + loc + 8);
    int soff = ttUSHORT(fc + loc + 10);

    if (slen <= 0) continue;

    const unsigned char *s = fc + stringOffset + soff;
    int c = 0;

    if (pid == 1) {
      c = macroman_to_ascii(s, slen, out, max_out);
    } else if (pid == 3 || pid == 0) {
      c = utf16be_to_ascii(s, slen, out, max_out);
    } else {
      c = macroman_to_ascii(s, slen, out, max_out);
    }

    if (c > 0) return c;
  }

  return 0;
}

static void extract_coords_sort(stbtt_vertex *verts, int n, float *xs, int *xs_c, float *ys, int *ys_c) {
  float tx[128], ty[128]; int xi = 0, yi = 0;
  for (int i = 0; i < n && xi < 128 && yi < 128; i++) {
    float vx = (float)verts[i].x, vy = (float)verts[i].y;
    int dup = 0; for (int j = 0; j < xi; j++) { if (tx[j] == vx) { dup = 1; break; } }
    if (!dup) tx[xi++] = vx;
    dup = 0; for (int j = 0; j < yi; j++) { if (ty[j] == vy) { dup = 1; break; } }
    if (!dup) ty[yi++] = vy;
    if (verts[i].type == STBTT_vcurve || verts[i].type == STBTT_vcubic) {
      vx = (float)verts[i].cx; vy = (float)verts[i].cy;
      dup = 0; for (int j = 0; j < xi; j++) { if (tx[j] == vx) { dup = 1; break; } }
      if (!dup && xi < 128) tx[xi++] = vx;
      dup = 0; for (int j = 0; j < yi; j++) { if (ty[j] == vy) { dup = 1; break; } }
      if (!dup && yi < 128) ty[yi++] = vy;
    }
    if (verts[i].type == STBTT_vcubic) {
      vx = (float)verts[i].cx1; vy = (float)verts[i].cy1;
      dup = 0; for (int j = 0; j < xi; j++) { if (tx[j] == vx) { dup = 1; break; } }
      if (!dup && xi < 128) tx[xi++] = vx;
      dup = 0; for (int j = 0; j < yi; j++) { if (ty[j] == vy) { dup = 1; break; } }
      if (!dup && yi < 128) ty[yi++] = vy;
    }
  }
  for (int i = 0; i < xi - 1; i++)
    for (int j = i + 1; j < xi; j++)
      if (tx[i] > tx[j]) { float t = tx[i]; tx[i] = tx[j]; tx[j] = t; }
  for (int i = 0; i < yi - 1; i++)
    for (int j = i + 1; j < yi; j++)
      if (ty[i] > ty[j]) { float t = ty[i]; ty[i] = ty[j]; ty[j] = t; }
  int xc = xi < MAX_COORDS ? xi : MAX_COORDS;
  int yc = yi < MAX_COORDS ? yi : MAX_COORDS;
  for (int i = 0; i < xc; i++) xs[i] = tx[i];
  for (int i = 0; i < yc; i++) ys[i] = ty[i];
  *xs_c = xc; *ys_c = yc;
}

static void trim_i_serifs(float *xs, int *xc, float *ys, int *yc) {
  if (*xc == 4 && *yc == 4) {
    for (int i = 0; i < *xc - 1; i++) xs[i] = xs[i + 1];
    (*xc)--; (*xc)--;
    for (int i = 1; i < *yc - 1; i++) ys[i] = ys[i + 1];
    (*yc)--;
    for (int i = 1; i < *yc - 1; i++) ys[i] = ys[i + 1];
    (*yc)--;
  }
}

static float get_size(float *arr, int count) {
  if (count < 2) return 0;
  return arr[count - 1] - arr[0];
}

static int serialize_vertices(stbtt_vertex *verts, int n, VertexCommand *out, int max_out) {
  int count = n < max_out ? n : max_out;
  for (int i = 0; i < count; i++) {
    out[i].type = verts[i].type;
    out[i].x = verts[i].x;
    out[i].y = verts[i].y;
    out[i].cx = verts[i].cx;
    out[i].cy = verts[i].cy;
    out[i].cx1 = verts[i].cx1;
    out[i].cy1 = verts[i].cy1;
  }
  return count;
}

static double ratio_percent(double width, double height) {
  if (height == 0.0) return 0.0;
  double raw = (width / height) * 100.0;
  return (double)((long long)(raw * 100.0 + (raw >= 0.0 ? 0.5 : -0.5))) / 100.0;
}

static int detect_vertical_stems(stbtt_vertex *verts, int n, int upe, float *stem_out, int max) {
  int sc = 0;
  float mh = (float)upe * 0.05f, mw = (float)upe * 0.01f;
  for (int i = 1; i < n && sc < max; i++) {
    float dx = verts[i].x > verts[i-1].x ? (float)(verts[i].x - verts[i-1].x) : (float)(verts[i-1].x - verts[i].x);
    float dy = verts[i].y > verts[i-1].y ? (float)(verts[i].y - verts[i-1].y) : (float)(verts[i-1].y - verts[i].y);
    if (dx < mw && dy > mh) {
      stem_out[sc * 3 + 0] = (float)(verts[i-1].x + verts[i].x) * 0.5f;
      stem_out[sc * 3 + 1] = (float)verts[i-1].y;
      stem_out[sc * 3 + 2] = (float)verts[i].y;
      sc++;
    }
  }
  return sc;
}

static int has_serif_protrusions(stbtt_vertex *verts, int n, int xmin, int xmax, float *stems, int sc) {
  float gw = (float)(xmax - xmin);
  if (gw == 0) return 0;
  for (int s = 0; s < sc; s++) {
    float yt = stems[s * 3 + 1] < stems[s * 3 + 2] ? stems[s * 3 + 1] : stems[s * 3 + 2];
    float yb = stems[s * 3 + 1] > stems[s * 3 + 2] ? stems[s * 3 + 1] : stems[s * 3 + 2];
    float tmn = 1e9f, tmx = -1e9f, bmn = 1e9f, bmx = -1e9f;
    for (int i = 0; i < n; i++) {
      float vy = (float)verts[i].y;
      if (vy > yt - 10 && vy < yt + 10) { float vx = (float)verts[i].x; if (vx < tmn) tmn = vx; if (vx > tmx) tmx = vx; }
      if (vy > yb - 10 && vy < yb + 10) { float vx = (float)verts[i].x; if (vx < bmn) bmn = vx; if (vx > bmx) bmx = vx; }
    }
    float tr = (tmx - tmn) / gw, br = (bmx - bmn) / gw;
    int hr = (tr >= 0.15f && tr <= 0.35f) || (br >= 0.15f && br <= 0.35f);
    if (!hr) continue;
    int hs = 0;
    for (int i = 1; i < n; i++) {
      float dx = verts[i].x > verts[i-1].x ? (float)(verts[i].x - verts[i-1].x) : (float)(verts[i-1].x - verts[i].x);
      float dy = verts[i].y > verts[i-1].y ? (float)(verts[i].y - verts[i-1].y) : (float)(verts[i-1].y - verts[i].y);
      float cy = (float)verts[i-1].y;
      if (dy < 5 && dx > 10 && dx < gw * 0.2f && ((cy > yt - 10 && cy < yt + 10) || (cy > yb - 10 && cy < yb + 10))) { hs = 1; break; }
    }
    if (hs) return 1;
  }
  return 0;
}

static int is_sans_serif_name(const char *name) {
  const char *sk[] = {"serif","times","georgia","garamond","baskerville","palatino","bookman","new york"};
  const char *ssk[] = {"sans","helvetica","arial","verdana","futura","calibri","tahoma","trebuchet","lucida","century gothic","gill sans","franklin","open sans"};
  for (int i = 0; i < 8; i++) { if (icontains(name, sk[i])) return 0; }
  for (int i = 0; i < 13; i++) { if (icontains(name, ssk[i])) return 1; }
  return -1;
}

static int analyze_serif_like(stbtt_fontinfo *font, int codepoint) {
  int gi = stbtt_FindGlyphIndex(font, codepoint);
  if (!gi) return 0;
  stbtt_vertex *verts; int n = stbtt_GetGlyphShape(font, gi, &verts);
  if (n <= 0) return 0;
  int x0, y0, x1, y1;
  stbtt_GetGlyphBox(font, gi, &x0, &y0, &x1, &y1);
  int upe = (font->head) ? ((font->data[font->head + 18] << 8) | font->data[font->head + 19]) : 1000;
  if (upe <= 0) upe = 1000;
  float stems[32]; int sc = detect_vertical_stems(verts, n, upe, stems, 10);
  int r = has_serif_protrusions(verts, n, x0, x1, stems, sc);
  STBTT_free(verts, NULL);
  return r;
}

static void get_glyph_metrics(stbtt_fontinfo *font, int cp, int trim, int filter_lc,
    float *xs, int *xc, float *ys, int *yc, float *w, float *h, float *r,
    VertexCommand *commands, int *command_count) {
  int gi = stbtt_FindGlyphIndex(font, cp);
  if (!gi) { *w=0;*h=0;*r=0;*xc=0;*yc=0;*command_count=0; return; }
  stbtt_vertex *verts; int n = stbtt_GetGlyphShape(font, gi, &verts);
  if (n <= 0) { *w=0;*h=0;*r=0;*xc=0;*yc=0;*command_count=0; return; }
  float tx[64], ty[64]; int txc, tyc;
  extract_coords_sort(verts, n, tx, &txc, ty, &tyc);
  if (trim) trim_i_serifs(tx, &txc, ty, &tyc);
  *w = get_size(tx, txc); *h = get_size(ty, tyc);
  *r = (float)ratio_percent((double)*w, (double)*h);
  for (int i = 0; i < txc && i < MAX_COORDS; i++) xs[i] = tx[i]; *xc = txc;
  for (int i = 0; i < tyc && i < MAX_COORDS; i++) ys[i] = ty[i]; *yc = tyc;
  *command_count = serialize_vertices(verts, n, commands, MAX_VERTICES);
  STBTT_free(verts, NULL);
}

typedef struct {
  int name_len, subfamily_len;
  int i_xc, i_yc, h_xc, h_yc, o_xc, o_yc;
  int i_vc, h_vc, o_vc;
  int is_sans_serif, is_not_italic, error;
  float i_w, i_h, i_r, h_w, h_h, h_r, o_w, o_h, o_r, body_ratio, stroke_ratio;
  float i_x[64], i_y[64], h_x[64], h_y[64], o_x[64], o_y[64];
  VertexCommand i_vertices[64], h_vertices[64], o_vertices[64];
  char name[256], subfamily[256];
} FontResult;

int analyze_font(int data_size) {
  hp = 0;
  memset(result_buf, 0, RESULT_SIZE);
  FontResult *out = (FontResult *)result_buf;
  stbtt_fontinfo font;
  int offset = stbtt_GetFontOffsetForIndex(font_data, 0);
  if (offset < 0) { out->error = -1; return -1; }
  if (stbtt__find_table(font_data, offset, "CFF2")) { out->error = -4; return -4; }
  if (stbtt__find_table(font_data, offset, "fvar")) { out->error = -3; return -3; }
  if (!stbtt_InitFont(&font, font_data, offset)) { out->error = -1; return -1; }
  if (get_name_entry(&font, 4, out->name, 256) <= 0)
    get_name_entry(&font, 1, out->name, 256);
  get_name_entry(&font, 2, out->subfamily, 256);
  out->name_len = strlen(out->name);
  out->subfamily_len = strlen(out->subfamily);
  get_glyph_metrics(&font, 0x49, 1, 0, out->i_x, &out->i_xc, out->i_y, &out->i_yc,
      &out->i_w, &out->i_h, &out->i_r, out->i_vertices, &out->i_vc);
  get_glyph_metrics(&font, 0x48, 0, 0, out->h_x, &out->h_xc, out->h_y, &out->h_yc,
      &out->h_w, &out->h_h, &out->h_r, out->h_vertices, &out->h_vc);
  get_glyph_metrics(&font, 0x4F, 0, 1, out->o_x, &out->o_xc, out->o_y, &out->o_yc,
      &out->o_w, &out->o_h, &out->o_r, out->o_vertices, &out->o_vc);
  out->stroke_ratio = out->i_r;
  out->body_ratio = (float)((double)(out->h_r + out->o_r) / 2.0);
  out->is_not_italic = icontains(out->subfamily, "italic") ? 0 : 1;
  int ss = is_sans_serif_name(out->name);
  if (ss < 0) {
    int sc = 0, t = 0; int ch[] = {0x41,0x45,0x48,0x42,0x47};
    for (int c = 0; c < 5; c++) { if (analyze_serif_like(&font, ch[c])) sc++; t++; }
    ss = (t > 0 && (float)sc / (float)t < 0.3f) ? 1 : 0;
  }
  out->is_sans_serif = ss;
  return 0;
}
