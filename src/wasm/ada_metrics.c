double ratio_percent(double width, double height) {
  if (height == 0.0) {
    return 0.0;
  }

  double raw = (width / height) * 100.0;
  return (double)((long long)(raw * 100.0 + (raw >= 0.0 ? 0.5 : -0.5))) / 100.0;
}

double average_percent(double first, double second) {
  double raw = (first + second) / 2.0;
  return (double)((long long)(raw * 100.0 + (raw >= 0.0 ? 0.5 : -0.5))) / 100.0;
}

int in_range(double min, double max, double ratio) {
  return ratio >= min && ratio <= max;
}

int standards_pass(
    int sans_serif,
    int not_italic,
    double body_min,
    double body_max,
    double body_ratio,
    double stroke_min,
    double stroke_max,
    double stroke_ratio) {
  if (!sans_serif || !not_italic) {
    return 0;
  }

  if (!in_range(body_min, body_max, body_ratio)) {
    return 0;
  }

  return in_range(stroke_min, stroke_max, stroke_ratio);
}

int federal_tactile_pass(int sans_serif, int not_italic, double body_ratio, double stroke_ratio) {
  return standards_pass(sans_serif, not_italic, 55.0, 110.0, body_ratio, 0.0, 15.0, stroke_ratio);
}

int federal_visual_pass(int sans_serif, int not_italic, double body_ratio, double stroke_ratio) {
  return standards_pass(sans_serif, not_italic, 55.0, 110.0, body_ratio, 10.0, 30.0, stroke_ratio);
}

int california_tactile_pass(int sans_serif, int not_italic, double body_ratio, double stroke_ratio) {
  return standards_pass(sans_serif, not_italic, 60.0, 110.0, body_ratio, 0.0, 15.0, stroke_ratio);
}

int california_visual_pass(int sans_serif, int not_italic, double body_ratio, double stroke_ratio) {
  return standards_pass(sans_serif, not_italic, 60.0, 110.0, body_ratio, 10.0, 20.0, stroke_ratio);
}
