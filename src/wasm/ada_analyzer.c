typedef unsigned long size_t;
#define NULL ((void*)0)

double sqrt(double x) { return x; }
double fabs(double x) { return x < 0 ? -x : x; }
double fmod(double x, double y) { (void)y; return x; }
double pow(double x, double y) { double r = 1.0; for (double i = 0; i < y; i++) r *= x; return r; }
double acos(double x) { (void)x; return 1.57; }
double cos(double x) { (void)x; return 1.0; }
double sin(double x) { (void)x; return 0; }
double tan(double x) { (void)x; return 0; }
double atan2(double x, double y) { (void)x; (void)y; return 0; }
double floor(double x) { return (double)(int)x; }
double ceil(double x) { int i = (int)x; if (x == (double)i) return x; if (x > 0) return (double)(i + 1); return (double)i; }

size_t strlen(const char *s) { size_t n=0; while(s[n]) n++; return n; }
void *memset(void *s, int c, size_t n) { unsigned char *p=s; for(size_t i=0;i<n;i++) p[i]=(unsigned char)c; return s; }
void *memcpy(void *d, const void *s, size_t n) { unsigned char *dp=d; const unsigned char *sp=s; for(size_t i=0;i<n;i++) dp[i]=sp[i]; return d; }

static char heap[2097152];
static int hp = 0;
void *malloc(size_t n) { void *p = heap + hp; hp += (int)n; if (hp > 2097152) return NULL; return p; }
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

static int analyze_serif_like_verts(stbtt_vertex *verts, int n, int upe) {
  int x0 = 100000, y0 = 100000, x1 = -100000, y1 = -100000;
  for (int i = 0; i < n; i++) {
    if (verts[i].x < x0) x0 = verts[i].x; if (verts[i].x > x1) x1 = verts[i].x;
    if (verts[i].y < y0) y0 = verts[i].y; if (verts[i].y > y1) y1 = verts[i].y;
  }
  if (x0 > x1) { x0 = 0; x1 = 100; }
  float stems[32]; int sc = detect_vertical_stems(verts, n, upe, stems, 10);
  return has_serif_protrusions(verts, n, x0, x1, stems, sc);
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

// ==================== FontResult struct ====================

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

// ==================== CFF (Compact Font Format) support ====================

#define CFF_CS_STACK 48
#define CFF_CALL_DEPTH 16

typedef struct {
  const unsigned char *data;
  int offSize;
  int count;
} CFFIndex;

static unsigned int cff_card(const unsigned char *p, int n) {
  unsigned int v = 0;
  for (int i = 0; i < n; i++) v = (v << 8) | p[i];
  return v;
}

static int cff_read_idx(unsigned char *cff, int off, CFFIndex *idx) {
  idx->count = (int)cff_card(cff + off, 2); off += 2;
  if (idx->count <= 0) { idx->data = NULL; idx->offSize = 0; return off; }
  idx->offSize = cff[off]; off++;
  idx->data = cff + off;
  int last = (int)cff_card(cff + off + idx->count * idx->offSize, idx->offSize);
  return off + (idx->count + 1) * idx->offSize + last - 1;
}

static const unsigned char *cff_index_entry(const CFFIndex *idx, int index, int *len) {
  if (index < 0 || index >= idx->count) { *len = 0; return NULL; }
  int o1 = (int)cff_card(idx->data + index * idx->offSize, idx->offSize);
  int o2 = (int)cff_card(idx->data + (index + 1) * idx->offSize, idx->offSize);
  *len = o2 - o1;
  return idx->data + (idx->count + 1) * idx->offSize + o1 - 1;
}

static int cff_skip_idx(const unsigned char *cff, int off) {
  int count = (int)cff_card(cff + off, 2); off += 2;
  if (count <= 0) return off;
  int offSize = cff[off]; off++;
  int last = (int)cff_card(cff + off + count * offSize, offSize);
  return off + (count + 1) * offSize + last - 1;
}

// DICT number/operator decoder
static int cff_dict_next(const unsigned char *p, int len, int *pos, int *val) {
  if (*pos >= len) { *val = 0; return -1; }
  int b0 = p[(*pos)++];
  if (b0 == 28) { if (*pos + 1 >= len) return -1; *val = (p[*pos] << 8) | p[*pos + 1]; *pos += 2; return 0; }
  if (b0 == 29) { if (*pos + 3 >= len) return -1; *val = (p[*pos] << 24) | (p[*pos+1] << 16) | (p[*pos+2] << 8) | p[*pos+3]; *pos += 4; return 0; }
  if (b0 >= 32 && b0 <= 246) { *val = b0 - 139; return 0; }
  if (b0 >= 247 && b0 <= 250) { if (*pos >= len) return -1; *val = (b0 - 247) * 256 + p[*pos] + 108; *pos += 1; return 0; }
  if (b0 >= 251 && b0 <= 254) { if (*pos >= len) return -1; *val = -(b0 - 251) * 256 - p[*pos] - 108; *pos += 1; return 0; }
  if (b0 == 30) {
    while (*pos < len) { int b = p[(*pos)++]; if ((b & 0x0F) == 0x0F) break; if ((b >> 4) == 0x0F) break; }
    *val = 0; return 0;
  }
  if (b0 == 12) { if (*pos >= len) return -1; *val = 0x0C00 | p[*pos]; (*pos)++; return 1; }
  *val = b0; return 1;
}

// Charstring number/operator decoder
static int cff_cs_next(const unsigned char *p, int len, int *pos, int *val) {
  if (*pos >= len) { *val = 0; return -1; }
  int b0 = p[(*pos)++];
  if (b0 == 28) { if (*pos + 1 >= len) return -1; *val = (p[*pos] << 8) | p[*pos + 1]; *pos += 2; return 0; }
  if (b0 >= 32 && b0 <= 246) { *val = b0 - 139; return 0; }
  if (b0 >= 247 && b0 <= 250) { if (*pos >= len) return -1; *val = (b0 - 247) * 256 + p[*pos] + 108; *pos += 1; return 0; }
  if (b0 >= 251 && b0 <= 254) { if (*pos >= len) return -1; *val = -(b0 - 251) * 256 - p[*pos] - 108; *pos += 1; return 0; }
  if (b0 == 12) { if (*pos >= len) return -1; *val = 0x0C00 | p[*pos]; (*pos)++; return 1; }
  *val = b0; return 1; // operator (including 29=callgsubr, 30=vhcurveto, 31=hvcurveto)
}

// --- CFF Runner ---

typedef struct {
  int stack[CFF_CS_STACK]; int sp;
  int x, y;
  int first_moveto;
  int width_done;
  int out_count;
  stbtt_vertex out[128];
  CFFIndex gsubrs;
  CFFIndex lsubrs;
  struct { const unsigned char *data; int pos, len; } callstack[CFF_CALL_DEPTH];
  int depth;
  int hint_count;
  int num_masters; // for CFF2 blend operator; 0 or 1 means no blend
} CFFRunner;

static void cffr_push(CFFRunner *r, int v) { if (r->sp < CFF_CS_STACK) r->stack[r->sp++] = v; }
static int cffr_pop(CFFRunner *r) { return r->sp > 0 ? r->stack[--r->sp] : 0; }

static void cffr_emit(CFFRunner *r, int type, int x, int y, int cx, int cy, int cx1, int cy1) {
  if (r->out_count >= 128) return;
  stbtt_vertex *v = &r->out[r->out_count++];
  v->type = (unsigned char)type;
  v->x = (short)x; v->y = (short)y;
  v->cx = (short)cx; v->cy = (short)cy;
  v->cx1 = (short)cx1; v->cy1 = (short)cy1;
}

static int cffr_exec(CFFRunner *r, const unsigned char *cs, int cs_len) {
  const unsigned char *cur = cs; int cur_len = cs_len; int pos = 0;
  int gbias = r->gsubrs.count <= 1240 ? 107 : (r->gsubrs.count <= 33900 ? 1131 : 32768);
  int lbias = r->lsubrs.count <= 1240 ? 107 : (r->lsubrs.count <= 33900 ? 1131 : 32768);
  r->depth = 0;

  while (1) {
    while (pos < cur_len) {
      int val, op;
      int rv = cff_cs_next(cur, cur_len, &pos, &val);
      if (rv < 0) goto cff_done;
      if (rv == 0) { cffr_push(r, val); continue; }

      op = val;

      // Hints (with CFF Type 2 width rule)
      if (op == 1 || op == 3 || op == 18 || op == 23) {
        if (!r->width_done && (r->sp & 1)) { r->width_done = 1; cffr_pop(r); }
        else if (r->sp & 1) cffr_pop(r);
        r->hint_count += r->sp / 2;
        r->sp = 0;
        continue;
      }
      if (op == 19 || op == 20) {
        r->sp = 0;
        pos += (r->hint_count + 7) / 8;
        continue;
      }

      // Moveto (with CFF Type 2 width rule)
      if (op == 21) { // rmoveto
        int total = r->sp;
        if (!r->width_done && total > 0 && total <= 2) {
          if (total == 1) { r->width_done = 1; r->sp = 0; }
          else { int dy = cffr_pop(r), dx = cffr_pop(r); r->x += dx; r->y += dy; }
        } else if (r->sp >= 2) { int dy = cffr_pop(r), dx = cffr_pop(r); r->x += dx; r->y += dy; }
        r->sp = 0;
        cffr_emit(r, STBTT_vmove, r->x, r->y, 0, 0, 0, 0);
        r->width_done = 1;
        continue;
      }
      if (op == 22) { // hmoveto
        int total = r->sp;
        if (!r->width_done && total > 0 && total <= 2) {
          if (total == 2) { r->width_done = 1; int dx = cffr_pop(r); r->x += dx; }
          else { int dx = cffr_pop(r); r->x += dx; }
        } else if (r->sp >= 1) { int dx = cffr_pop(r); r->x += dx; }
        r->sp = 0;
        cffr_emit(r, STBTT_vmove, r->x, r->y, 0, 0, 0, 0);
        r->width_done = 1;
        continue;
      }
      if (op == 4) { // vmoveto
        int total = r->sp;
        if (!r->width_done && total > 0 && total <= 2) {
          if (total == 2) { r->width_done = 1; int dy = cffr_pop(r); r->y += dy; }
          else { int dy = cffr_pop(r); r->y += dy; }
        } else if (r->sp >= 1) { int dy = cffr_pop(r); r->y += dy; }
        r->sp = 0;
        cffr_emit(r, STBTT_vmove, r->x, r->y, 0, 0, 0, 0);
        r->width_done = 1;
        continue;
      }

      // Lines
      if (op == 5) { while (r->sp >= 2) { int dy=cffr_pop(r),dx=cffr_pop(r); r->x+=dx;r->y+=dy; cffr_emit(r,STBTT_vline,r->x,r->y,0,0,0,0); } continue; }
      if (op == 6) { int alt=0; while (r->sp >= 1) { int v=cffr_pop(r); if(!alt) r->x+=v; else r->y+=v; cffr_emit(r,STBTT_vline,r->x,r->y,0,0,0,0); alt=!alt; } continue; }
      if (op == 7) { int alt=0; while (r->sp >= 1) { int v=cffr_pop(r); if(!alt) r->y+=v; else r->x+=v; cffr_emit(r,STBTT_vline,r->x,r->y,0,0,0,0); alt=!alt; } continue; }

      // Curves (cubic)
      if (op == 8) { // rrcurveto: {dx1 dy1 dx2 dy2 dx3 dy3}+
        while (r->sp >= 6) {
          int dy3=cffr_pop(r),dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r),dx1=cffr_pop(r);
          int cp1x=r->x+dx1,cp1y=r->y+dy1;
          int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
          int nx=cp2x+dx3,ny=cp2y+dy3;
          cffr_emit(r,STBTT_vcubic,nx,ny,cp1x,cp1y,cp2x,cp2y);
          r->x=nx;r->y=ny;
        }
        continue;
      }
      if (op == 24) { // rcurveline: {dx1 dy1 dx2 dy2 dx3 dy3}+ dx dy
        // line args are at top of stack; pop them first, then process curves
        if (r->sp >= 8) {
          int line_dy=cffr_pop(r),line_dx=cffr_pop(r);
          while (r->sp >= 6) {
            int dy3=cffr_pop(r),dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r),dx1=cffr_pop(r);
            int cp1x=r->x+dx1,cp1y=r->y+dy1;
            int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
            int nx=cp2x+dx3,ny=cp2y+dy3;
            cffr_emit(r,STBTT_vcubic,nx,ny,cp1x,cp1y,cp2x,cp2y);
            r->x=nx;r->y=ny;
          }
          r->x+=line_dx;r->y+=line_dy;
          cffr_emit(r,STBTT_vline,r->x,r->y,0,0,0,0);
        } else r->sp=0;
        continue;
      }
      if (op == 25) { // rlinecurve: {dx dy}+ dx1 dy1 dx2 dy2 dx3 dy3
        // curve args are at top of stack (last pushed); pop them first
        if (r->sp < 8) continue;
        int dy3=cffr_pop(r),dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r),dx1=cffr_pop(r);
        while (r->sp >= 2) { int dy=cffr_pop(r),dx=cffr_pop(r); r->x+=dx;r->y+=dy; cffr_emit(r,STBTT_vline,r->x,r->y,0,0,0,0); }
        int cp1x=r->x+dx1,cp1y=r->y+dy1;
        int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
        int nx=cp2x+dx3,ny=cp2y+dy3;
        cffr_emit(r,STBTT_vcubic,nx,ny,cp1x,cp1y,cp2x,cp2y);
        r->x=nx;r->y=ny;
        continue;
      }
      if (op == 26) { // vvcurveto: [dx1] dya dxb dyb dyc
        if (r->sp == 4) { // dya dxb dyb dyc (dx1=0 implicit)
          int dy3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r);
          int cp1y=r->y+dy1;
          int cp2y=cp1y+dy2;
          int ny=cp2y+dy3;
          cffr_emit(r,STBTT_vcubic,r->x+dx2,ny,r->x,cp1y,r->x+dx2,cp2y);
          r->x=r->x+dx2;r->y=ny;
        } else if (r->sp == 5) { // dx1 dya dxb dyb dyc
          int dy3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r),dx1=cffr_pop(r);
          int cp1x=r->x+dx1,cp1y=r->y+dy1;
          int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
          int ny=cp2y+dy3;
          cffr_emit(r,STBTT_vcubic,cp2x,ny,cp1x,cp1y,cp2x,cp2y);
          r->x=cp2x;r->y=ny;
        } else r->sp=0;
        continue;
      }
      if (op == 27) { // hhcurveto: [dy1] dxa dxb dyb dxc
        if (r->sp == 4) { // dxa dxb dyb dxc (dy1=0 implicit)
          int dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dx1=cffr_pop(r);
          int cp1x=r->x+dx1;
          int cp2x=cp1x+dx2,cp2y=r->y+dy2;
          int nx=cp2x+dx3;
          cffr_emit(r,STBTT_vcubic,nx,cp2y,cp1x,r->y,cp2x,cp2y);
          r->x=nx;r->y=cp2y;
        } else if (r->sp == 5) { // dy1 dxa dxb dyb dxc
          int dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dx1=cffr_pop(r),dy1=cffr_pop(r);
          int cp1x=r->x+dx1,cp1y=r->y+dy1;
          int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
          int nx=cp2x+dx3;
          cffr_emit(r,STBTT_vcubic,nx,cp2y,cp1x,cp1y,cp2x,cp2y);
          r->x=nx;r->y=cp2y;
        } else r->sp=0;
        continue;
      }
      if (op == 30) { // vhcurveto: alternating {dy1 dx2 dy2 dx3}+ / {dx1 dx2 dy2 dx3}+
        int alt = 0;
        while (r->sp >= 4) {
          int dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),first=cffr_pop(r);
          if (!alt) { // vertical start: dy1, dx2, dy2, dx3
            int nx=r->x+dx2+dx3,ny=r->y+first+dy2;
            cffr_emit(r,STBTT_vcubic,nx,ny,r->x,r->y+first,r->x+dx2,r->y+first+dy2);
            r->x=nx;r->y=ny;
          } else { // horizontal start: dx1, dx2, dy2, dx3
            int nx=r->x+first+dx2+dx3,ny=r->y+dy2;
            cffr_emit(r,STBTT_vcubic,nx,ny,r->x+first,r->y,r->x+first+dx2,r->y+dy2);
            r->x=nx;r->y=ny;
          }
          alt = !alt;
        }
        r->sp = 0;
        continue;
      }
      if (op == 31) { // hvcurveto: alternating {dx1 dx2 dy2 dy3}+ / {dy1 dx2 dy2 dx3}+
        int alt = 0;
        while (r->sp >= 4) {
          int last=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),first=cffr_pop(r);
          if (!alt) { // horizontal start: dx1, dx2, dy2, dy3
            int nx=r->x+first+dx2,ny=r->y+dy2+last;
            cffr_emit(r,STBTT_vcubic,nx,ny,r->x+first,r->y,r->x+first+dx2,r->y+dy2);
            r->x=nx;r->y=ny;
          } else { // vertical start: dy1, dx2, dy2, dx3
            int nx=r->x+dx2+last,ny=r->y+first+dy2;
            cffr_emit(r,STBTT_vcubic,nx,ny,r->x,r->y+first,r->x+dx2,r->y+first+dy2);
            r->x=nx;r->y=ny;
          }
          alt = !alt;
        }
        r->sp = 0;
        continue;
      }

      // Flex operators
      if (op == (0x0C00 | 0x22)) { // hflex: dx1 dx2 dy2 dx3 dx4 dx5 dx6
        if (r->sp >= 7) {
          int dx6=cffr_pop(r),dx5=cffr_pop(r),dx4=cffr_pop(r),dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dx1=cffr_pop(r);
          int cp1x=r->x+dx1;
          int cp2x=cp1x+dx2,cp2y=r->y+dy2;
          int midx=cp2x+dx3; // mid.y = r->y (hflex: endpoint y = start y)
          cffr_emit(r,STBTT_vcubic,midx,r->y,cp1x,r->y,cp2x,cp2y);
          int mcp1x=midx+dx4;
          int mcp2x=mcp1x+dx5,mcp2y=r->y-dy2;
          int endx=mcp2x+dx6;
          cffr_emit(r,STBTT_vcubic,endx,r->y,mcp1x,r->y,mcp2x,mcp2y);
          r->x=endx;
        }
        continue;
      }
      if (op == (0x0C00 | 0x23)) { // flex: dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 dx6 dy6 fd
        if (r->sp >= 13) {
          int fd=cffr_pop(r),dy6=cffr_pop(r),dx6=cffr_pop(r),dy5=cffr_pop(r),dx5=cffr_pop(r);
          int dy4=cffr_pop(r),dx4=cffr_pop(r),dy3=cffr_pop(r),dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r),dx1=cffr_pop(r);
          (void)fd;
          int cp1x=r->x+dx1,cp1y=r->y+dy1;
          int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
          int mx=cp2x+dx3,my=cp2y+dy3;
          cffr_emit(r,STBTT_vcubic,mx,my,cp1x,cp1y,cp2x,cp2y);
          int mcp1x=mx+dx4,mcp1y=my+dy4;
          int mcp2x=mcp1x+dx5,mcp2y=mcp1y+dy5;
          int ex=mcp2x+dx6,ey=mcp2y+dy6;
          cffr_emit(r,STBTT_vcubic,ex,ey,mcp1x,mcp1y,mcp2x,mcp2y);
          r->x=ex;r->y=ey;
        }
        continue;
      }
      if (op == (0x0C00 | 0x24)) { // hflex1: dx1 dy1 dx2 dy2 dx3 dx4 dx5 dy5 dx6 dy6
        if (r->sp >= 10) {
          int dy6=cffr_pop(r),dx6=cffr_pop(r),dy5=cffr_pop(r),dx5=cffr_pop(r);
          int dx4=cffr_pop(r),dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r),dx1=cffr_pop(r);
          int cp1x=r->x+dx1,cp1y=r->y+dy1;
          int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
          int mx=cp2x+dx3,my=cp2y; // dy3=0
          cffr_emit(r,STBTT_vcubic,mx,my,cp1x,cp1y,cp2x,cp2y);
          int mcp1x=mx+dx4; // dy4=0
          int mcp2x=mcp1x+dx5,mcp2y=my+dy5;
          int ex=mcp2x+dx6,ey=mcp2y+dy6;
          cffr_emit(r,STBTT_vcubic,ex,ey,mcp1x,my,mcp2x,mcp2y);
          r->x=ex;r->y=ey;
        }
        continue;
      }
      if (op == (0x0C00 | 0x25)) { // flex1: dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 dx6 dy6 fd
        if (r->sp >= 13) {
          int fd=cffr_pop(r),dy6=cffr_pop(r),dx6=cffr_pop(r);
          int dy5=cffr_pop(r),dx5=cffr_pop(r),dy4=cffr_pop(r),dx4=cffr_pop(r);
          int dy3=cffr_pop(r),dx3=cffr_pop(r),dy2=cffr_pop(r),dx2=cffr_pop(r),dy1=cffr_pop(r),dx1=cffr_pop(r);
          (void)fd;
          int cp1x=r->x+dx1,cp1y=r->y+dy1;
          int cp2x=cp1x+dx2,cp2y=cp1y+dy2;
          int mx=cp2x+dx3,my=cp2y+dy3;
          cffr_emit(r,STBTT_vcubic,mx,my,cp1x,cp1y,cp2x,cp2y);
          int mcp1x=mx+dx4,mcp1y=my+dy4;
          int mcp2x=mcp1x+dx5,mcp2y=mcp1y+dy5;
          int ex=mcp2x+dx6,ey=mcp2y+dy6;
          cffr_emit(r,STBTT_vcubic,ex,ey,mcp1x,mcp1y,mcp2x,mcp2y);
          r->x=ex;r->y=ey;
        }
        continue;
      }

      // Subroutines
      if (op == 10) { // callsubr (local)
        if (r->sp < 1) continue;
        int subr = cffr_pop(r);
        int idx = subr + lbias;
        int subr_len;
        const unsigned char *sdata = cff_index_entry(&r->lsubrs, idx, &subr_len);
        if (sdata && r->depth < CFF_CALL_DEPTH) {
          r->callstack[r->depth].data = cur; r->callstack[r->depth].pos = pos; r->callstack[r->depth].len = cur_len;
          r->depth++;
          cur = sdata; cur_len = subr_len; pos = 0;
        }
        continue;
      }
      if (op == 29) { // callgsubr (global)
        if (r->sp < 1) continue;
        int subr = cffr_pop(r);
        int idx = subr + gbias;
        int subr_len;
        const unsigned char *sdata = cff_index_entry(&r->gsubrs, idx, &subr_len);
        if (sdata && r->depth < CFF_CALL_DEPTH) {
          r->callstack[r->depth].data = cur; r->callstack[r->depth].pos = pos; r->callstack[r->depth].len = cur_len;
          r->depth++;
          cur = sdata; cur_len = subr_len; pos = 0;
        }
        continue;
      }
      if (op == 11) { // return
        if (r->depth > 0) {
          r->depth--;
          cur = r->callstack[r->depth].data;
          pos = r->callstack[r->depth].pos;
          cur_len = r->callstack[r->depth].len;
        }
        continue;
      }

      // Endchar
      if (op == 14) {
        if (!r->width_done && r->sp == 1) r->width_done = 1;
        r->sp = 0; goto cff_done;
      }

      // Arithmetic / stack operators
      if (op == (0x0C00|7)) { if(r->sp>=2){int b=cffr_pop(r),a=cffr_pop(r);cffr_push(r,a+b);} continue; }
      if (op == (0x0C00|8)) { if(r->sp>=2){int b=cffr_pop(r),a=cffr_pop(r);cffr_push(r,a-b);} continue; }
      if (op == (0x0C00|9)) { if(r->sp>=2){int b=cffr_pop(r),a=cffr_pop(r);cffr_push(r,b?a/b:0);} continue; }
      if (op == (0x0C00|18)) { if(r->sp>=2){int b=cffr_pop(r),a=cffr_pop(r);cffr_push(r,a*b);} continue; }
      if (op == (0x0C00|6)) { if(r->sp>=1){int a=cffr_pop(r);cffr_push(r,a<0?-a:a);} continue; }
      if (op == (0x0C00|10)) { if(r->sp>=1){int a=cffr_pop(r);cffr_push(r,-a);} continue; }
      if (op == (0x0C00|21)) { if(r->sp>=1){int a=r->stack[r->sp-1];cffr_push(r,a);} continue; }
      if (op == (0x0C00|22)) { if(r->sp>=2){int a=r->stack[r->sp-1];r->stack[r->sp-1]=r->stack[r->sp-2];r->stack[r->sp-2]=a;} continue; }
      if (op == (0x0C00|23)) { if(r->sp>=1){int i=cffr_pop(r);if(i>=0&&i<r->sp)cffr_push(r,r->stack[r->sp-1-i]);} continue; }
      if (op == (0x0C00|12)) { if(r->sp>=1)cffr_pop(r); continue; }
      if (op == (0x0C00|3)) { if(r->sp>=2){int b=cffr_pop(r),a=cffr_pop(r);cffr_push(r,a&b);} continue; }
      if (op == (0x0C00|4)) { if(r->sp>=2){int b=cffr_pop(r),a=cffr_pop(r);cffr_push(r,a|b);} continue; }
      if (op == (0x0C00|5)) { if(r->sp>=1){int a=cffr_pop(r);cffr_push(r,a?0:1);} continue; }
      if (op == (0x0C00|11)) { if(r->sp>=2){int b=cffr_pop(r),a=cffr_pop(r);cffr_push(r,a==b?1:0);} continue; }
      if (op == (0x0C00|15)) { if(r->sp>=1){int a=r->stack[r->sp-1];cffr_push(r,a);} continue; } // dup (alt)

      // CFF2 blend operator: keep default values (bottom n of stack), discard deltas
      if (op == 16 && r->num_masters > 1) {
        if (r->sp < 1) continue;
        int n = cffr_pop(r);
        int total = n * r->num_masters;
        if (total > r->sp) total = r->sp;
        int saved[CFF_CS_STACK], save_n = n < CFF_CS_STACK ? n : CFF_CS_STACK;
        for (int i = 0; i < save_n; i++) saved[i] = r->stack[r->sp - total + i];
        r->sp -= total;
        for (int i = 0; i < save_n; i++) cffr_push(r, saved[i]);
        continue;
      }

      // Unknown operator - clear stack as safety
      if (op <= 31 || (op >= 0x0C00 && op <= 0x0CFF)) r->sp = 0;
    }
    if (r->depth > 0) {
      r->depth--;
      cur = r->callstack[r->depth].data;
      pos = r->callstack[r->depth].pos;
      cur_len = r->callstack[r->depth].len;
    } else break;
  }
cff_done:
  return r->out_count;
}

// ==================== cmap parser ====================

static int cmap_fmt4_lookup(unsigned char *data, int codepoint) {
  int segCount = ttUSHORT(data + 6) >> 1;
  for (int i = 0; i < segCount; i++) {
    int endCode = ttUSHORT(data + 14 + i * 2);
    if (codepoint > endCode) continue;
    int startCode = ttUSHORT(data + 16 + segCount * 2 + i * 2);
    if (codepoint < startCode) break;
    int idDelta = ttSHORT(data + 16 + segCount * 4 + i * 2);
    int idRangeOffset = ttUSHORT(data + 16 + segCount * 6 + i * 2);
    if (idRangeOffset == 0) return (codepoint + idDelta) & 0xFFFF;
    int offset = idRangeOffset / 2 + (codepoint - startCode);
    int g = ttUSHORT(data + 16 + segCount * 6 + segCount * 2 + offset * 2);
    if (g != 0) return (g + idDelta) & 0xFFFF;
    return 0;
  }
  return 0;
}

static int cmap_fmt12_lookup(unsigned char *data, int codepoint) {
  int nGroups = (int)ttULONG(data + 12);
  for (int i = 0; i < nGroups; i++) {
    unsigned int sc = ttULONG(data + 16 + i * 12);
    unsigned int ec = ttULONG(data + 20 + i * 12);
    unsigned int sg = ttULONG(data + 24 + i * 12);
    if ((unsigned)codepoint >= sc && (unsigned)codepoint <= ec)
      return (int)(sg + codepoint - sc);
  }
  return 0;
}

static int cmap_find_glyph(unsigned char *data, int offset, int codepoint) {
  unsigned int cmap = stbtt__find_table(data, offset, "cmap");
  if (!cmap) return 0;
  int numTables = ttUSHORT(data + cmap + 2);
  for (int i = 0; i < numTables; i++) {
    int platform = ttUSHORT(data + cmap + 4 + i * 8);
    int encoding = ttUSHORT(data + cmap + 6 + i * 8);
    unsigned int sub = cmap + ttULONG(data + cmap + 8 + i * 8);
    int fmt = ttUSHORT(data + sub);
    if (fmt == 4 && (platform == 3 || platform == 0)) {
      int g = cmap_fmt4_lookup(data + sub, codepoint);
      if (g) return g;
    }
    if (fmt == 12 && (platform == 3 || platform == 0)) {
      int g = cmap_fmt12_lookup(data + sub, codepoint);
      if (g) return g;
    }
  }
  for (int i = 0; i < numTables; i++) {
    unsigned int sub = cmap + ttULONG(data + cmap + 8 + i * 8);
    if (ttUSHORT(data + sub) == 4) {
      int g = cmap_fmt4_lookup(data + sub, codepoint);
      if (g) return g;
    }
  }
  return 0;
}

// ==================== CFF font analysis ====================

static int read_upe(unsigned char *data, int offset) {
  unsigned int head = stbtt__find_table(data, offset, "head");
  if (!head) return 1000;
  return ttUSHORT(data + head + 18);
}

// Analyze a CFF1 font. Returns 0 on success.
static int analyze_cff_font(unsigned char *fc, int offset, int data_size, FontResult *out) {
  (void)data_size;
  int upe = read_upe(fc, offset);
  if (upe <= 0) upe = 1000;

  unsigned int cff_off = stbtt__find_table(fc, offset, "CFF ");
  if (!cff_off) return -1;
  unsigned char *cff = fc + cff_off;

  int pos = cff[2]; // hdrSize
  if (pos < 4) pos = 4;

  // Skip Name INDEX
  pos = cff_skip_idx(cff, pos);

  // Top Dict INDEX
  CFFIndex top_idx;
  pos = cff_read_idx(cff, pos, &top_idx);
  if (top_idx.count < 1) return -1;

  // Parse Top Dict
  int cs_offset = 0, charset_offset = 0, priv_size = 0, priv_offset = 0;
  int is_cid = 0;
  {
    int tp, tlen; const unsigned char *td = cff_index_entry(&top_idx, 0, &tlen);
    if (!td) return -1;
    int stack[48], sp = 0; tp = 0;
    while (tp < tlen) {
      int val, op;
      int rv = cff_dict_next(td, tlen, &tp, &val);
      if (rv < 0) break;
      if (rv == 0) { if (sp < 48) stack[sp++] = val; continue; }
      op = val;
      if (op == 15 && sp >= 1) charset_offset = stack[sp-1];
      if (op == 17 && sp >= 1) cs_offset = stack[sp-1];
      if (op == 18 && sp >= 2) { priv_size = stack[sp-2]; priv_offset = stack[sp-1]; }
      if (op == (0x0C00|30) && sp >= 3) is_cid = 1;
      sp = 0;
    }
  }
  (void)charset_offset;

  if (is_cid) return -1; // CID-keyed CFF not supported

  // Skip String INDEX
  pos = cff_skip_idx(cff, pos);

  // Global Subrs INDEX
  CFFIndex gsubrs;
  pos = cff_read_idx(cff, pos, &gsubrs);

  // Parse Private Dict
  int default_w = 0, nominal_w = 0;
  CFFIndex lsubrs; memset(&lsubrs, 0, sizeof(lsubrs));
  if (priv_size > 0 && priv_offset > 0) {
    int pp = priv_offset;
    int pend = priv_offset + priv_size;
    int stack[16], sp = 0;
    while (pp < pend) {
      int val, op;
      int rv = cff_dict_next(cff, pend, &pp, &val);
      if (rv < 0) break;
      if (rv == 0) { if (sp < 16) stack[sp++] = val; continue; }
      op = val;
      if (op == 9 && sp >= 1) default_w = stack[sp-1];
      if (op == 10 && sp >= 1) nominal_w = stack[sp-1];
      if (op == 19 && sp >= 1) {
        int lsubr_off = priv_offset + stack[sp-1];
        cff_read_idx(cff, lsubr_off, &lsubrs);
      }
      sp = 0;
    }
  }
  (void)default_w; (void)nominal_w;

  // CharStrings INDEX
  CFFIndex charstrings;
  cff_read_idx(cff, cs_offset, &charstrings);
  if (charstrings.count < 3) return -1;

  // Find glyph indices
  int glyphs[3]; int cps[3] = {0x49, 0x48, 0x4F};
  for (int i = 0; i < 3; i++) glyphs[i] = cmap_find_glyph(fc, offset, cps[i]);

  // Name table
  stbtt_fontinfo fake_font;
  fake_font.data = fc;
  fake_font.fontstart = offset;
  if (get_name_entry(&fake_font, 4, out->name, 256) <= 0)
    get_name_entry(&fake_font, 1, out->name, 256);
  get_name_entry(&fake_font, 2, out->subfamily, 256);
  out->name_len = (int)strlen(out->name);
  out->subfamily_len = (int)strlen(out->subfamily);

  int trim_flags[3] = {1, 0, 0};
  float *xs[] = {out->i_x, out->h_x, out->o_x};
  int *xcs[] = {&out->i_xc, &out->h_xc, &out->o_xc};
  float *ys[] = {out->i_y, out->h_y, out->o_y};
  int *ycs[] = {&out->i_yc, &out->h_yc, &out->o_yc};
  float *ws[] = {&out->i_w, &out->h_w, &out->o_w};
  float *hs[] = {&out->i_h, &out->h_h, &out->o_h};
  float *rs[] = {&out->i_r, &out->h_r, &out->o_r};
  VertexCommand *vcmds[] = {out->i_vertices, out->h_vertices, out->o_vertices};
  int *vcs[] = {&out->i_vc, &out->h_vc, &out->o_vc};

  for (int gi = 0; gi < 3; gi++) {
    int gid = glyphs[gi];
    if (gid <= 0 || gid >= charstrings.count) {
      *ws[gi]=0; *hs[gi]=0; *rs[gi]=0; *xcs[gi]=0; *ycs[gi]=0; *vcs[gi]=0;
      continue;
    }
    int cs_len;
    const unsigned char *cs_data = cff_index_entry(&charstrings, gid, &cs_len);
    if (!cs_data || cs_len <= 0) {
      *ws[gi]=0; *hs[gi]=0; *rs[gi]=0; *xcs[gi]=0; *ycs[gi]=0; *vcs[gi]=0;
      continue;
    }
    CFFRunner runner;
    memset(&runner, 0, sizeof(runner));
    runner.gsubrs = gsubrs;
    runner.lsubrs = lsubrs;
    int n = cffr_exec(&runner, cs_data, cs_len);

    float tx[64], ty[64];
    if (n > 0) {
      extract_coords_sort(runner.out, n, tx, xcs[gi], ty, ycs[gi]);
    } else {
      *xcs[gi] = 0; *ycs[gi] = 0;
    }
    if (trim_flags[gi]) trim_i_serifs(tx, xcs[gi], ty, ycs[gi]);
    *ws[gi] = get_size(tx, *xcs[gi]);
    *hs[gi] = get_size(ty, *ycs[gi]);
    *rs[gi] = (float)ratio_percent((double)*ws[gi], (double)*hs[gi]);
    for (int i = 0; i < *xcs[gi] && i < MAX_COORDS; i++) xs[gi][i] = tx[i];
    for (int i = 0; i < *ycs[gi] && i < MAX_COORDS; i++) ys[gi][i] = ty[i];
    *vcs[gi] = serialize_vertices(runner.out, n, vcmds[gi], MAX_VERTICES);
  }

  out->stroke_ratio = out->i_r;
  out->body_ratio = (float)((double)(out->h_r + out->o_r) / 2.0);
  out->is_not_italic = icontains(out->subfamily, "italic") ? 0 : 1;
  int ss = is_sans_serif_name(out->name);
  if (ss < 0 && glyphs[0] > 0 && glyphs[0] < charstrings.count) {
    int sc = 0, t = 0;
    int test_chars[] = {0x41,0x45,0x48,0x42,0x47};
    for (int c = 0; c < 5; c++) {
      int g = cmap_find_glyph(fc, offset, test_chars[c]);
      if (g <= 0 || g >= charstrings.count) continue;
      int clen;
      const unsigned char *cd = cff_index_entry(&charstrings, g, &clen);
      if (!cd || clen <= 0) continue;
      CFFRunner sr; memset(&sr, 0, sizeof(sr));
      sr.gsubrs = gsubrs; sr.lsubrs = lsubrs;
      int sn = cffr_exec(&sr, cd, clen);
      if (sn > 0 && analyze_serif_like_verts(sr.out, sn, upe)) sc++;
      t++;
    }
    ss = (t > 0 && (float)sc / (float)t < 0.3f) ? 1 : 0;
  }
  out->is_sans_serif = ss > 0 ? 1 : 0;
  return 0;
}

// ==================== CFF2 font analysis ====================

static int analyze_cff2_font(unsigned char *fc, int offset, int data_size, FontResult *out) {
  (void)data_size;
  int upe = read_upe(fc, offset);
  if (upe <= 0) upe = 1000;

  unsigned int cff2_off = stbtt__find_table(fc, offset, "CFF2");
  if (!cff2_off) return -1;
  unsigned char *cff2 = fc + cff2_off;

  int hdr_size = cff2[2];
  if (hdr_size < 5) hdr_size = 5;
  int top_dict_len = (cff2[3] << 8) | cff2[4];

  // Parse Top DICT
  int cs_offset = 0, priv_size = 0, priv_offset = 0, vstore_offset = 0;
  {
    const unsigned char *td = cff2 + hdr_size;
    int tlen = top_dict_len, tp = 0, stack[48], sp = 0;
    while (tp < tlen) {
      int val, op, rv = cff_dict_next(td, tlen, &tp, &val);
      if (rv < 0) break;
      if (rv == 0) { if (sp < 48) stack[sp++] = val; continue; }
      op = val;
      if (op == 17 && sp >= 1) cs_offset = stack[sp-1];
      if (op == 18 && sp >= 2) { priv_size = stack[sp-2]; priv_offset = stack[sp-1]; }
      if (op == 24 && sp >= 1) vstore_offset = stack[sp-1];
      sp = 0;
    }
  }
  if (cs_offset <= 0) return -1;

  // Global Subrs INDEX
  CFFIndex gsubrs;
  cff_read_idx(cff2, hdr_size + top_dict_len, &gsubrs);

  // Get numMasters from ItemVariationStore
  int num_masters = 1;
  if (vstore_offset > 0 && vstore_offset + 8 < (int)(8 * 1024 * 1024)) {
    unsigned char *vs = cff2 + vstore_offset;
    unsigned int rlist_rel = ttULONG(vs + 2);
    if (vstore_offset + rlist_rel + 4 < (int)(8 * 1024 * 1024)) {
      unsigned char *rlist = cff2 + vstore_offset + rlist_rel;
      num_masters = (int)ttUSHORT(rlist + 2) + 1;
    }
  }

  // Parse Private DICT
  CFFIndex lsubrs; memset(&lsubrs, 0, sizeof(lsubrs));
  if (priv_size > 0 && priv_offset > 0) {
    unsigned char *priv = cff2 + priv_offset;
    int pp = 0, stack[16], sp = 0;
    while (pp < priv_size) {
      int val, op, rv = cff_dict_next(priv, priv_size, &pp, &val);
      if (rv < 0) break;
      if (rv == 0) { if (sp < 16) stack[sp++] = val; continue; }
      op = val;
      if (op == 19 && sp >= 1) cff_read_idx(cff2, priv_offset + stack[sp-1], &lsubrs);
      sp = 0;
    }
  }

  // CharStrings INDEX
  CFFIndex charstrings;
  cff_read_idx(cff2, cs_offset, &charstrings);
  if (charstrings.count < 3) return -1;

  // Glyph indices via cmap
  int glyphs[3]; int cps[3] = {0x49, 0x48, 0x4F};
  for (int i = 0; i < 3; i++) glyphs[i] = cmap_find_glyph(fc, offset, cps[i]);

  // Name table
  stbtt_fontinfo fake_font;
  fake_font.data = fc; fake_font.fontstart = offset;
  if (get_name_entry(&fake_font, 4, out->name, 256) <= 0)
    get_name_entry(&fake_font, 1, out->name, 256);
  get_name_entry(&fake_font, 2, out->subfamily, 256);
  out->name_len = (int)strlen(out->name);
  out->subfamily_len = (int)strlen(out->subfamily);

  int trim_flags[3] = {1, 0, 0};
  float *xs[] = {out->i_x, out->h_x, out->o_x};
  int *xcs[] = {&out->i_xc, &out->h_xc, &out->o_xc};
  float *ys[] = {out->i_y, out->h_y, out->o_y};
  int *ycs[] = {&out->i_yc, &out->h_yc, &out->o_yc};
  float *ws[] = {&out->i_w, &out->h_w, &out->o_w};
  float *hs[] = {&out->i_h, &out->h_h, &out->o_h};
  float *rs[] = {&out->i_r, &out->h_r, &out->o_r};
  VertexCommand *vcmds[] = {out->i_vertices, out->h_vertices, out->o_vertices};
  int *vcs[] = {&out->i_vc, &out->h_vc, &out->o_vc};

  for (int gi = 0; gi < 3; gi++) {
    int gid = glyphs[gi];
    if (gid <= 0 || gid >= charstrings.count) {
      *ws[gi]=0; *hs[gi]=0; *rs[gi]=0; *xcs[gi]=0; *ycs[gi]=0; *vcs[gi]=0;
      continue;
    }
    int cs_len;
    const unsigned char *cs_data = cff_index_entry(&charstrings, gid, &cs_len);
    if (!cs_data || cs_len <= 0) {
      *ws[gi]=0; *hs[gi]=0; *rs[gi]=0; *xcs[gi]=0; *ycs[gi]=0; *vcs[gi]=0;
      continue;
    }
    CFFRunner runner; memset(&runner, 0, sizeof(runner));
    runner.gsubrs = gsubrs; runner.lsubrs = lsubrs;
    runner.num_masters = num_masters;
    runner.width_done = 1; // CFF2 width is in hmtx, not charstring
    int n = cffr_exec(&runner, cs_data, cs_len);

    float tx[64], ty[64];
    if (n > 0) {
      extract_coords_sort(runner.out, n, tx, xcs[gi], ty, ycs[gi]);
    } else { *xcs[gi]=0; *ycs[gi]=0; }
    if (trim_flags[gi]) trim_i_serifs(tx, xcs[gi], ty, ycs[gi]);
    *ws[gi] = get_size(tx, *xcs[gi]);
    *hs[gi] = get_size(ty, *ycs[gi]);
    *rs[gi] = (float)ratio_percent((double)*ws[gi], (double)*hs[gi]);
    for (int i = 0; i < *xcs[gi] && i < MAX_COORDS; i++) xs[gi][i] = tx[i];
    for (int i = 0; i < *ycs[gi] && i < MAX_COORDS; i++) ys[gi][i] = ty[i];
    *vcs[gi] = serialize_vertices(runner.out, n, vcmds[gi], MAX_VERTICES);
  }

  out->stroke_ratio = out->i_r;
  out->body_ratio = (float)((double)(out->h_r + out->o_r) / 2.0);
  out->is_not_italic = icontains(out->subfamily, "italic") ? 0 : 1;
  int ss = is_sans_serif_name(out->name);
  if (ss < 0 && glyphs[0] > 0 && glyphs[0] < charstrings.count) {
    int sc = 0, t = 0;
    int test_chars[] = {0x41,0x45,0x48,0x42,0x47};
    for (int c = 0; c < 5; c++) {
      int g = cmap_find_glyph(fc, offset, test_chars[c]);
      if (g <= 0 || g >= charstrings.count) continue;
      int clen; const unsigned char *cd = cff_index_entry(&charstrings, g, &clen);
      if (!cd || clen <= 0) continue;
      CFFRunner sr; memset(&sr, 0, sizeof(sr));
      sr.gsubrs = gsubrs; sr.lsubrs = lsubrs;
      sr.num_masters = num_masters; sr.width_done = 1;
      int sn = cffr_exec(&sr, cd, clen);
      if (sn > 0 && analyze_serif_like_verts(sr.out, sn, upe)) sc++;
      t++;
    }
    ss = (t > 0 && (float)sc / (float)t < 0.3f) ? 1 : 0;
  }
  out->is_sans_serif = ss > 0 ? 1 : 0;
  return 0;
}

// ==================== Variable font support ====================

#define MAX_VAR_AXES 16
#define MAX_VAR_INSTANCES 64

static int g_axis_count = 0;
static int g_instance_count = 0;
static short g_instance_norm_axes[MAX_VAR_INSTANCES][MAX_VAR_AXES];
static char g_instance_names[MAX_VAR_INSTANCES][128];
static char g_cur_instance_name[128];

static float f2dot14_to_float(short v) { return (float)v / 16384.0f; }
static short float_to_f2dot14(float v) {
  float clamped = v < -1.0f ? -1.0f : (v > 1.0f ? 1.0f : v);
  return (short)(clamped * 16384.0f + (clamped >= 0.0f ? 0.5f : -0.5f));
}

static float read_fixed16(unsigned char *data, int off) {
  short hi = (short)((data[off] << 8) | data[off+1]);
  unsigned short lo = (unsigned short)((data[off+2] << 8) | data[off+3]);
  return (float)hi + (float)lo / 65536.0f;
}

int get_instance_name_ptr(void) { return (int)(size_t)g_cur_instance_name; }

void fill_instance_name(int index) {
  if (index < 0 || index >= g_instance_count) { g_cur_instance_name[0] = 0; return; }
  int i = 0;
  while (i < 127 && g_instance_names[index][i]) { g_cur_instance_name[i] = g_instance_names[index][i]; i++; }
  g_cur_instance_name[i] = 0;
}

// Parse fvar and normalize instance axis values. Returns instance count (0 if not variable).
int prepare_instances(int data_size) {
  (void)data_size;
  g_axis_count = 0; g_instance_count = 0;
  int offset = stbtt_GetFontOffsetForIndex(font_data, 0);
  if (offset < 0) return 0;
  unsigned int fvar = stbtt__find_table(font_data, offset, "fvar");
  if (!fvar) return 0;

  int axes_offset = ttUSHORT(font_data + fvar + 4);
  int axis_count  = ttUSHORT(font_data + fvar + 8);
  int axis_size   = ttUSHORT(font_data + fvar + 10);
  int inst_count  = ttUSHORT(font_data + fvar + 12);
  int inst_size   = ttUSHORT(font_data + fvar + 14);

  if (axis_count  > MAX_VAR_AXES)      axis_count  = MAX_VAR_AXES;
  if (inst_count  > MAX_VAR_INSTANCES) inst_count  = MAX_VAR_INSTANCES;
  if (axis_size   < 20) axis_size = 20;
  if (inst_size   < 4 + axis_count * 4) inst_size = 4 + axis_count * 4;

  float amin[MAX_VAR_AXES], adef[MAX_VAR_AXES], amax[MAX_VAR_AXES];
  for (int a = 0; a < axis_count; a++) {
    int aoff = (int)fvar + axes_offset + a * axis_size;
    // axisTag(4), minValue(Fixed), defaultValue(Fixed), maxValue(Fixed)
    amin[a] = read_fixed16(font_data, aoff + 4);
    adef[a] = read_fixed16(font_data, aoff + 8);
    amax[a] = read_fixed16(font_data, aoff + 12);
  }

  int inst_start = (int)fvar + axes_offset + axis_count * axis_size;
  stbtt_fontinfo fake; fake.data = font_data; fake.fontstart = offset;

  for (int i = 0; i < inst_count; i++) {
    int ioff = inst_start + i * inst_size;
    int name_id = ttUSHORT(font_data + ioff);
    // Coordinates: Fixed[axisCount] at ioff+4
    for (int a = 0; a < axis_count; a++) {
      float coord = read_fixed16(font_data, ioff + 4 + a * 4);
      float norm;
      if (coord == adef[a]) { norm = 0.0f; }
      else if (coord < adef[a]) {
        float d = adef[a] - amin[a];
        norm = d == 0.0f ? 0.0f : (coord - adef[a]) / d;
      } else {
        float d = amax[a] - adef[a];
        norm = d == 0.0f ? 0.0f : (coord - adef[a]) / d;
      }
      g_instance_norm_axes[i][a] = float_to_f2dot14(norm);
    }
    get_name_entry(&fake, name_id, g_instance_names[i], 128);
    if (g_instance_names[i][0] == 0) {
      g_instance_names[i][0] = '?'; g_instance_names[i][1] = 0;
    }
  }
  g_axis_count = axis_count;
  g_instance_count = inst_count;
  return inst_count;
}

// Decode packed point number list from gvar serialized data.
// Returns count; if all_points is set, caller should use all n_verts points.
static int decode_packed_points(unsigned char *data, int data_len, int *pos,
    int *points, int max_pts, int *all_points) {
  *all_points = 0;
  if (*pos >= data_len) return 0;
  int count_byte = data[(*pos)++];
  if (count_byte == 0) { *all_points = 1; return 0; }
  int count;
  if (count_byte & 0x80) {
    if (*pos >= data_len) return 0;
    count = ((count_byte & 0x7F) << 8) | data[(*pos)++];
  } else { count = count_byte; }
  int n = 0, pt = 0;
  while (n < count && *pos < data_len) {
    int ctrl = data[(*pos)++];
    int are_words = (ctrl >> 7) & 1;
    int run_count = (ctrl & 0x7F) + 1;
    for (int r = 0; r < run_count && n < count && *pos < data_len; r++) {
      int delta;
      if (are_words) {
        if (*pos + 1 >= data_len) break;
        delta = ttUSHORT(data + *pos); *pos += 2;
      } else { delta = data[(*pos)++]; }
      pt += delta;
      if (n < max_pts) points[n] = pt;
      n++;
    }
  }
  return n;
}

// Decode packed delta values for a sequence of `count` entries.
static int decode_packed_deltas(unsigned char *data, int data_len, int *pos,
    int *deltas, int count) {
  int n = 0;
  while (n < count && *pos < data_len) {
    int ctrl = data[(*pos)++];
    int are_zero  = (ctrl >> 7) & 1;
    int are_words = (ctrl >> 6) & 1;
    int run_count = (ctrl & 0x3F) + 1;
    for (int r = 0; r < run_count && n < count; r++) {
      if (are_zero) { deltas[n++] = 0; }
      else if (are_words) {
        if (*pos + 1 >= data_len) { deltas[n++] = 0; continue; }
        deltas[n++] = (short)ttUSHORT(data + *pos); *pos += 2;
      } else {
        if (*pos >= data_len) { deltas[n++] = 0; continue; }
        deltas[n++] = (signed char)data[(*pos)++];
      }
    }
  }
  return n;
}

// Read raw TrueType glyph points (on-curve and off-curve).
// flags_out: per-point flag byte (bit 0 = on-curve). end_pts_out: contour end indices. n_contours_out: contour count.
// Returns number of points read.
static int read_raw_glyph_pts(stbtt_fontinfo *font, int glyph_index,
    short *x_out, short *y_out, unsigned char *flags_out, short *end_pts_out, int *n_contours_out,
    int max_pts) {
  int g = stbtt__GetGlyfOffset(font, glyph_index);
  if (g < 0) return 0;
  unsigned char *data = font->data;
  int nc = (short)ttUSHORT(data + g);
  if (nc <= 0) return 0;
  if (n_contours_out) *n_contours_out = nc;
  if (end_pts_out) for (int i = 0; i < nc && i < 64; i++)
    end_pts_out[i] = (short)ttUSHORT(data + g + 10 + i * 2);

  int n_pts = (int)ttUSHORT(data + g + 10 + (nc - 1) * 2) + 1;
  if (n_pts > max_pts) n_pts = max_pts;

  int ins = (int)ttUSHORT(data + g + 10 + nc * 2);
  unsigned char *pts = data + g + 10 + nc * 2 + 2 + ins;

  // Read flags with repeat compression
  unsigned char lflags[512]; unsigned char flagcount = 0, cur_flag = 0;
  for (int i = 0; i < n_pts && i < 512; i++) {
    if (flagcount == 0) { cur_flag = *pts++; if (cur_flag & 8) flagcount = *pts++; }
    else flagcount--;
    lflags[i] = cur_flag;
  }
  if (flags_out) for (int i = 0; i < n_pts; i++) flags_out[i] = lflags[i];

  // Read x-coordinates (cumulative)
  short x = 0;
  for (int i = 0; i < n_pts; i++) {
    unsigned char f = lflags[i];
    if (f & 2) { short dx = *pts++; x += (f & 16) ? dx : (short)(-dx); }
    else if (!(f & 16)) { x += (short)((pts[0] << 8) | pts[1]); pts += 2; }
    x_out[i] = x;
  }

  // Read y-coordinates (cumulative)
  short y = 0;
  for (int i = 0; i < n_pts; i++) {
    unsigned char f = lflags[i];
    if (f & 4) { short dy = *pts++; y += (f & 32) ? dy : (short)(-dy); }
    else if (!(f & 32)) { y += (short)((pts[0] << 8) | pts[1]); pts += 2; }
    y_out[i] = y;
  }
  return n_pts;
}

// extract_coords_sort equivalent for raw short x[], y[] arrays.
static void extract_raw_coords_sort(short *x_pts, short *y_pts, int n,
    float *xs, int *xs_c, float *ys, int *ys_c) {
  float tx[128], ty[128]; int xi = 0, yi = 0;
  for (int i = 0; i < n && xi < 128 && yi < 128; i++) {
    float vx = (float)x_pts[i], vy = (float)y_pts[i];
    int dup = 0; for (int j = 0; j < xi; j++) if (tx[j] == vx) { dup=1; break; }
    if (!dup) tx[xi++] = vx;
    dup = 0; for (int j = 0; j < yi; j++) if (ty[j] == vy) { dup=1; break; }
    if (!dup) ty[yi++] = vy;
  }
  for (int i = 0; i < xi-1; i++) for (int j=i+1; j<xi; j++) if (tx[i]>tx[j]) { float t=tx[i];tx[i]=tx[j];tx[j]=t; }
  for (int i = 0; i < yi-1; i++) for (int j=i+1; j<yi; j++) if (ty[i]>ty[j]) { float t=ty[i];ty[i]=ty[j];ty[j]=t; }
  int xc = xi < MAX_COORDS ? xi : MAX_COORDS;
  int yc = yi < MAX_COORDS ? yi : MAX_COORDS;
  for (int i=0;i<xc;i++) xs[i]=tx[i];
  for (int i=0;i<yc;i++) ys[i]=ty[i];
  *xs_c=xc; *ys_c=yc;
}

// Reconstruct TrueType quadratic-bezier vertex stream from raw glyph points (after gvar delta).
// Replicates stb_truetype's contour-closing logic so the output matches what serialize_vertices expects.
static void setv_raw(stbtt_vertex *v, unsigned char type, int x, int y, int cx, int cy) {
  v->type = type; v->x = (short)x; v->y = (short)y;
  v->cx = (short)cx; v->cy = (short)cy; v->cx1 = 0; v->cy1 = 0;
}
static int close_tt_shape(stbtt_vertex *vs, int nv, int was_off, int start_off,
    int sx, int sy, int scx, int scy, int cx, int cy, int max) {
  if (start_off) {
    if (was_off && nv < max) setv_raw(&vs[nv++], STBTT_vcurve, (cx+scx)>>1, (cy+scy)>>1, cx, cy);
    if (nv < max) setv_raw(&vs[nv++], STBTT_vcurve, sx, sy, scx, scy);
  } else {
    if (was_off && nv < max) setv_raw(&vs[nv++], STBTT_vcurve, sx, sy, cx, cy);
    else if (nv < max) setv_raw(&vs[nv++], STBTT_vline, sx, sy, 0, 0);
  }
  return nv;
}
static int build_tt_vertices(short *xp, short *yp, unsigned char *pf,
    short *end_pts, int n_contours, stbtt_vertex *verts, int max_verts) {
  if (n_contours <= 0) return 0;
  int nv = 0, j = 0, next_move = 0;
  int was_off = 0, start_off = 0;
  int sx = 0, sy = 0, scx = 0, scy = 0, cx = 0, cy = 0;
  int total = (int)end_pts[n_contours - 1] + 1;
  for (int i = 0; i < total; i++) {
    if (i == next_move) {
      if (i != 0) nv = close_tt_shape(verts, nv, was_off, start_off, sx, sy, scx, scy, cx, cy, max_verts);
      was_off = 0;
      next_move = (j < n_contours) ? (int)end_pts[j] + 1 : total;
      j++;
      if (!(pf[i] & 1)) {
        start_off = 1; scx = xp[i]; scy = yp[i];
        if (i + 1 < total && !(pf[i+1] & 1)) { sx = (xp[i]+xp[i+1])>>1; sy = (yp[i]+yp[i+1])>>1; }
        else if (i + 1 < total) { i++; sx = xp[i]; sy = yp[i]; }
        else { sx = xp[i]; sy = yp[i]; }
      } else { start_off = 0; sx = xp[i]; sy = yp[i]; }
      if (nv < max_verts) setv_raw(&verts[nv++], STBTT_vmove, sx, sy, 0, 0);
      continue;
    }
    if (!(pf[i] & 1)) {
      if (was_off && nv < max_verts) setv_raw(&verts[nv++], STBTT_vcurve, (cx+xp[i])>>1, (cy+yp[i])>>1, cx, cy);
      cx = xp[i]; cy = yp[i]; was_off = 1;
    } else {
      if (was_off) { if (nv < max_verts) setv_raw(&verts[nv++], STBTT_vcurve, xp[i], yp[i], cx, cy); }
      else { if (nv < max_verts) setv_raw(&verts[nv++], STBTT_vline, xp[i], yp[i], 0, 0); }
      was_off = 0;
    }
  }
  if (total > 0) nv = close_tt_shape(verts, nv, was_off, start_off, sx, sy, scx, scy, cx, cy, max_verts);
  return nv;
}

// IUP: interpolate deltas for untouched points in one contour along one axis.
// orig[]: original (pre-delta) coordinate values for all points.
// delta[]: delta array — touched points already have their delta; untouched will be filled.
// touched[]: 1 if the point received an explicit delta, else 0.
// start/end: inclusive contour point range.
static void iup_contour_axis(short *orig, float *delta, char *touched, int start, int end) {
  int n = end - start + 1;

  // Find the first touched point
  int first_t = -1;
  for (int i = 0; i < n; i++) {
    if (touched[start + i]) { first_t = i; break; }
  }
  if (first_t < 0) return; // No touched points — deltas stay 0

  // Check for only one touched point
  int has_second = 0;
  for (int i = 1; i < n; i++) {
    if (touched[start + (first_t + i) % n]) { has_second = 1; break; }
  }
  if (!has_second) {
    float d = delta[start + first_t];
    for (int i = 0; i < n; i++)
      if (!touched[start + i]) delta[start + i] = d;
    return;
  }

  // Walk every consecutive touched-point pair around the contour, filling untouched points.
  int t1 = first_t;
  do {
    // Find t2: next touched point after t1
    int t2 = -1;
    for (int i = 1; i < n; i++) {
      int j = (t1 + i) % n;
      if (touched[start + j]) { t2 = j; break; }
    }
    if (t2 < 0) break;

    int t1a = start + t1, t2a = start + t2;
    short o1 = orig[t1a], o2 = orig[t2a];
    float d1 = delta[t1a], d2 = delta[t2a];

    // Interpolate untouched points strictly between t1 and t2 (forward direction)
    for (int i = 1; i < n; i++) {
      int p = (t1 + i) % n;
      if (p == t2) break;
      int pa = start + p;
      if (touched[pa]) break; // should not happen for a consecutive pair
      short op = orig[pa];
      if (o1 == o2) {
        delta[pa] = d1;
      } else {
        short lo = o1 < o2 ? o1 : o2;
        short hi = o1 < o2 ? o2 : o1;
        if (op <= lo) {
          // clamp to whichever touched point has the lower coord
          delta[pa] = (o1 <= o2) ? d1 : d2;
        } else if (op >= hi) {
          delta[pa] = (o1 >= o2) ? d1 : d2;
        } else {
          // linear interpolation
          delta[pa] = d1 + (d2 - d1) * (float)(op - o1) / (float)(o2 - o1);
        }
      }
    }

    t1 = t2;
  } while (t1 != first_t);
}

// Apply gvar delta interpolation for a specific named instance to raw glyph points in-place.
// end_pts/n_contours are required for IUP (interpolating untouched points between contour neighbors).
static void apply_gvar_deltas(unsigned char *fc, int offset, int glyph_index,
    short *norm_axes, int axis_count, short *x_pts, short *y_pts, int n_pts,
    short *end_pts, int n_contours) {
  unsigned int gvar_off = stbtt__find_table(fc, offset, "gvar");
  if (!gvar_off) return;

  int gv_axis_count = ttUSHORT(fc + gvar_off + 4);
  if (gv_axis_count != axis_count) return;

  int shared_tc = ttUSHORT(fc + gvar_off + 6);
  unsigned int shared_tuples_off = gvar_off + ttULONG(fc + gvar_off + 8);
  int glyph_count = ttUSHORT(fc + gvar_off + 12);
  int flags = ttUSHORT(fc + gvar_off + 14);
  unsigned int gdata_arr = gvar_off + ttULONG(fc + gvar_off + 16);

  if (glyph_index < 0 || glyph_index >= glyph_count) return;

  unsigned int gd_start, gd_end;
  if (flags & 1) {
    gd_start = gdata_arr + ttULONG(fc + gvar_off + 20 + glyph_index * 4);
    gd_end   = gdata_arr + ttULONG(fc + gvar_off + 20 + (glyph_index+1) * 4);
  } else {
    gd_start = gdata_arr + (unsigned int)ttUSHORT(fc + gvar_off + 20 + glyph_index * 2) * 2;
    gd_end   = gdata_arr + (unsigned int)ttUSHORT(fc + gvar_off + 20 + (glyph_index+1) * 2) * 2;
  }
  if (gd_start >= gd_end) return;

  unsigned char *gd = fc + gd_start;
  int gd_size = (int)(gd_end - gd_start);

  int tvc_raw = ttUSHORT(gd);
  int tuple_count = tvc_raw & 0x0FFF;
  int has_shared_pts = (tvc_raw >> 15) & 1; // bit 15 = SHARED_POINT_NUMBERS (0x8000)
  int data_off = ttUSHORT(gd + 2);

  unsigned char *ser = gd + data_off;
  int ser_size = gd_size - data_off;
  int ser_pos = 0;

  // Total accumulated deltas across all active tuples.
  static float dx[512], dy[512];
  // Per-tuple temporary arrays for specific-point IUP.
  static float tdx[512], tdy[512];
  static char touched[512];
  static short ox[512], oy[512];
  int np = n_pts < 512 ? n_pts : 512;
  for (int i = 0; i < np; i++) {
    ox[i] = x_pts[i]; oy[i] = y_pts[i];
    dx[i] = 0.0f; dy[i] = 0.0f;
  }

  int shared_pts[512]; int shared_pt_cnt = 0; int shared_all = 0;
  if (has_shared_pts)
    shared_pt_cnt = decode_packed_points(ser, ser_size, &ser_pos, shared_pts, 512, &shared_all);

  int hdr_pos = 4;
  for (int t = 0; t < tuple_count; t++) {
    if (hdr_pos + 4 > gd_size) break;
    int vdata_size = ttUSHORT(gd + hdr_pos); hdr_pos += 2;
    int tflags = ttUSHORT(gd + hdr_pos); hdr_pos += 2;
    int has_emb_peak   = (tflags >> 15) & 1;
    int has_interm     = (tflags >> 14) & 1;
    int has_private_pt = (tflags >> 13) & 1;
    int shared_idx     = tflags & 0x0FFF;

    float peak[MAX_VAR_AXES] = {0};
    if (has_emb_peak) {
      for (int a = 0; a < axis_count && hdr_pos + 2 <= gd_size; a++) {
        peak[a] = f2dot14_to_float((short)ttUSHORT(gd + hdr_pos)); hdr_pos += 2;
      }
    } else if (shared_idx < shared_tc) {
      unsigned char *sp = fc + shared_tuples_off + shared_idx * axis_count * 2;
      for (int a = 0; a < axis_count; a++)
        peak[a] = f2dot14_to_float((short)ttUSHORT(sp + a * 2));
    }

    float lower[MAX_VAR_AXES], upper[MAX_VAR_AXES];
    if (has_interm) {
      for (int a = 0; a < axis_count && hdr_pos + 2 <= gd_size; a++) {
        lower[a] = f2dot14_to_float((short)ttUSHORT(gd + hdr_pos)); hdr_pos += 2;
      }
      for (int a = 0; a < axis_count && hdr_pos + 2 <= gd_size; a++) {
        upper[a] = f2dot14_to_float((short)ttUSHORT(gd + hdr_pos)); hdr_pos += 2;
      }
    } else {
      for (int a = 0; a < axis_count; a++) {
        lower[a] = peak[a] >= 0.0f ? 0.0f : peak[a];
        upper[a] = peak[a] <= 0.0f ? 0.0f : peak[a];
      }
    }

    float scalar = 1.0f;
    for (int a = 0; a < axis_count; a++) {
      float p = peak[a];
      if (p == 0.0f) continue;
      float v = f2dot14_to_float(norm_axes[a]);
      float lo = lower[a], hi = upper[a];
      if (v < lo || v > hi) { scalar = 0.0f; break; }
      if (v == p) continue;
      if (v < p) { float d = p - lo; scalar *= d == 0.0f ? 0.0f : (v - lo) / d; }
      else        { float d = hi - p; scalar *= d == 0.0f ? 0.0f : (hi - v) / d; }
    }

    int tser_start = ser_pos;
    if (scalar != 0.0f) {
      int priv_pts[512]; int priv_pt_cnt = 0; int priv_all = 0;
      if (has_private_pt)
        priv_pt_cnt = decode_packed_points(ser, ser_size, &ser_pos, priv_pts, 512, &priv_all);

      int *pts     = has_private_pt ? priv_pts     : shared_pts;
      int  pt_cnt  = has_private_pt ? priv_pt_cnt  : shared_pt_cnt;
      int  all_pts = has_private_pt ? priv_all      : shared_all;
      // TrueType glyphs have 4 phantom points appended after outline points in gvar.
      // When "all points" mode is used, the delta arrays include these phantom entries.
      // We must read the full count (n_pts+4) so the y-delta block starts at the right
      // offset, then only apply deltas to the n_pts real outline points.
      int n_gvar = n_pts + 4;
      int total   = all_pts ? n_gvar : pt_cnt;

      int xd[516] = {0}, yd[516] = {0};
      decode_packed_deltas(ser, ser_size, &ser_pos, xd, total);
      decode_packed_deltas(ser, ser_size, &ser_pos, yd, total);

      if (all_pts) {
        // All-points tuple: directly accumulate into totals (no IUP needed).
        for (int i = 0; i < np; i++) {
          dx[i] += xd[i] * scalar;
          dy[i] += yd[i] * scalar;
        }
      } else {
        // Specific-point tuple: IUP must run per-tuple so untouched points get
        // their inferred delta BEFORE the next tuple's all-points deltas are added.
        for (int i = 0; i < np; i++) { tdx[i] = 0.0f; tdy[i] = 0.0f; touched[i] = 0; }
        for (int i = 0; i < pt_cnt; i++) {
          int pi = pts[i];
          if (pi >= 0 && pi < np) {
            tdx[pi] = xd[i] * scalar;
            tdy[pi] = yd[i] * scalar;
            touched[pi] = 1;
          }
        }
        // Run IUP for this tuple using the original (pre-variation) coordinates.
        int cs = 0;
        for (int c = 0; c < n_contours && c < 64; c++) {
          int ce = (int)end_pts[c]; if (ce >= np) ce = np - 1;
          iup_contour_axis(ox, tdx, touched, cs, ce);
          iup_contour_axis(oy, tdy, touched, cs, ce);
          cs = ce + 1;
        }
        // Accumulate per-tuple deltas (explicit + IUP-inferred) into totals.
        for (int i = 0; i < np; i++) {
          dx[i] += tdx[i];
          dy[i] += tdy[i];
        }
      }
    }
    ser_pos = tser_start + vdata_size;
  }

  // Apply final accumulated deltas back to the point arrays (no final IUP pass needed).
  for (int i = 0; i < np; i++) {
    x_pts[i] = (short)(ox[i] + (int)(dx[i] + (dx[i] >= 0 ? 0.5f : -0.5f)));
    y_pts[i] = (short)(oy[i] + (int)(dy[i] + (dy[i] >= 0 ? 0.5f : -0.5f)));
  }
}

// Analyze a TrueType variable font at a specific named instance.
static int analyze_var_font_instance(unsigned char *fc, int offset, int instance_index,
    FontResult *out) {
  stbtt_fontinfo font;
  if (!stbtt_InitFont(&font, fc, offset)) { out->error = -1; return -1; }
  int upe = read_upe(fc, offset);
  if (upe <= 0) upe = 1000;

  if (get_name_entry(&font, 4, out->name, 200) <= 0)
    get_name_entry(&font, 1, out->name, 200);
  get_name_entry(&font, 2, out->subfamily, 256);

  // Append instance name in parentheses
  if (instance_index >= 0 && instance_index < g_instance_count) {
    int nl = (int)strlen(out->name);
    const char *iname = g_instance_names[instance_index];
    if (nl < 248 && iname[0]) {
      out->name[nl++] = ' '; out->name[nl++] = '(';
      for (int j = 0; j < 127 && iname[j] && nl < 253; j++) out->name[nl++] = iname[j];
      out->name[nl++] = ')'; out->name[nl] = 0;
    }
  }
  out->name_len = (int)strlen(out->name);
  out->subfamily_len = (int)strlen(out->subfamily);

  short *norm_axes = (instance_index >= 0 && instance_index < g_instance_count)
    ? g_instance_norm_axes[instance_index] : NULL;

  static short x_pts[512], y_pts[512];
  static unsigned char glyph_flags[512];
  static short end_pts[64];
  int cps[3] = {0x49, 0x48, 0x4F};
  int trim[3] = {1, 0, 0};

  float *xs[] = {out->i_x, out->h_x, out->o_x};
  int *xcs[] = {&out->i_xc, &out->h_xc, &out->o_xc};
  float *ys[] = {out->i_y, out->h_y, out->o_y};
  int *ycs[] = {&out->i_yc, &out->h_yc, &out->o_yc};
  float *ws[] = {&out->i_w, &out->h_w, &out->o_w};
  float *hs[] = {&out->i_h, &out->h_h, &out->o_h};
  float *rs[] = {&out->i_r, &out->h_r, &out->o_r};
  int *vcs[] = {&out->i_vc, &out->h_vc, &out->o_vc};
  VertexCommand *vcmds[] = {out->i_vertices, out->h_vertices, out->o_vertices};

  for (int gi = 0; gi < 3; gi++) {
    int glyph_idx = stbtt_FindGlyphIndex(&font, cps[gi]);
    *xcs[gi]=0; *ycs[gi]=0; *ws[gi]=0; *hs[gi]=0; *rs[gi]=0; *vcs[gi]=0;
    if (!glyph_idx) continue;

    int nc = 0;
    int n = read_raw_glyph_pts(&font, glyph_idx, x_pts, y_pts, glyph_flags, end_pts, &nc, 512);
    if (n <= 0) continue;

    if (norm_axes) apply_gvar_deltas(fc, offset, glyph_idx, norm_axes, g_axis_count, x_pts, y_pts, n, end_pts, nc);

    // Reconstruct bezier vertex stream from the (gvar-modified) raw points.
    static stbtt_vertex tt_verts[256];
    int nv = build_tt_vertices(x_pts, y_pts, glyph_flags, end_pts, nc, tt_verts, 256);
    if (nv <= 0) continue;

    // Derive guide-line coordinates from the vertex stream (same as static path) so
    // green dots and guide lines stay aligned — raw points miss implied midpoints.
    float tx[64], ty[64];
    extract_coords_sort(tt_verts, nv, tx, xcs[gi], ty, ycs[gi]);
    if (trim[gi]) trim_i_serifs(tx, xcs[gi], ty, ycs[gi]);
    *ws[gi] = get_size(tx, *xcs[gi]);
    *hs[gi] = get_size(ty, *ycs[gi]);
    *rs[gi] = (float)ratio_percent((double)*ws[gi], (double)*hs[gi]);
    for (int i=0;i<*xcs[gi]&&i<MAX_COORDS;i++) xs[gi][i]=tx[i];
    for (int i=0;i<*ycs[gi]&&i<MAX_COORDS;i++) ys[gi][i]=ty[i];

    *vcs[gi] = serialize_vertices(tt_verts, nv, vcmds[gi], MAX_VERTICES);
  }

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

int analyze_font(int data_size); // forward declaration

// Exported: analyze a specific named instance (instance_index >= 0) or default (-1).
int analyze_font_instance(int data_size, int instance_index) {
  hp = 0;
  memset(result_buf, 0, RESULT_SIZE);
  FontResult *out = (FontResult *)result_buf;

  int offset = stbtt_GetFontOffsetForIndex(font_data, 0);
  if (offset < 0) { out->error = -1; return -1; }

  if (stbtt__find_table(font_data, offset, "fvar")) {
    return analyze_var_font_instance(font_data, offset, instance_index, out);
  }

  // Fallback to standard analysis for non-variable fonts
  return analyze_font(data_size);
}

// ==================== Main entry point ====================

int analyze_font(int data_size) {
  hp = 0;
  memset(result_buf, 0, RESULT_SIZE);
  FontResult *out = (FontResult *)result_buf;

  int offset = stbtt_GetFontOffsetForIndex(font_data, 0);
  if (offset < 0) { out->error = -1; return -1; }

  // CFF2 (OpenType with CFF2 outlines, including variable CFF2)
  if (stbtt__find_table(font_data, offset, "CFF2")) {
    return analyze_cff2_font(font_data, offset, data_size, out);
  }

  // Variable TrueType: fall through to standard TT analysis (default instance)
  // Named instances are handled via analyze_font_instance().

  // CFF1: stb_truetype won't work (no glyf table), use custom CFF parser
  if (stbtt__find_table(font_data, offset, "CFF ")) {
    return analyze_cff_font(font_data, offset, data_size, out);
  }

  // TrueType / OpenType with glyf table
  stbtt_fontinfo font;
  if (!stbtt_InitFont(&font, font_data, offset)) { out->error = -1; return -1; }

  if (get_name_entry(&font, 4, out->name, 256) <= 0)
    get_name_entry(&font, 1, out->name, 256);
  get_name_entry(&font, 2, out->subfamily, 256);
  out->name_len = (int)strlen(out->name);
  out->subfamily_len = (int)strlen(out->subfamily);

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
