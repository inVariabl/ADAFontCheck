<script>
  export let metric;
</script>

<dl>
  <div><dt>Width</dt><dd>{metric.width.toFixed(2)}</dd></div>
  <div><dt>Height</dt><dd>{metric.height.toFixed(2)}</dd></div>
  <div><dt>Ratio</dt><dd>{metric.ratio.toFixed(2)}%</dd></div>
</dl>
