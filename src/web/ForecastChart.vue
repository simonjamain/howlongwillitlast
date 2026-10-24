<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from "vue";
import { use, init, type EChartsType } from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Forecast, Measurement } from "../domain/types";
use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);
const props = defineProps<{
  measurements: readonly Measurement[];
  forecasts: readonly Forecast[];
  allLabel: string;
  fiveLabel: string;
  recordedLabel: string;
  locale: string;
}>();
const element = ref<HTMLElement>();
let chart: EChartsType | undefined;
let observer: ResizeObserver | undefined;
function render() {
  chart?.setOption(
    {
      animation: false,
      aria: { enabled: true },
      color: ["#26574e", "#d88c3d", "#387cc1"],
      grid: { left: 60, right: 24, top: 50, bottom: 55 },
      tooltip: { trigger: "axis", renderMode: "richText" },
      legend: { type: "scroll", top: 8, textStyle: { color: "#526560" } },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "#c7d5cd" } },
        axisLabel: {
          hideOverlap: true,
          formatter: (value: number) =>
            new Date(value).toLocaleDateString(props.locale, {
              day: "numeric",
              month: "short",
            }),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        splitLine: { lineStyle: { color: "#edf1ed" } },
        axisLabel: { color: "#6a7972" },
      },
      series: [
        {
          name: props.recordedLabel,
          type: "scatter",
          symbolSize: 9,
          itemStyle: { color: "#26574e" },
          data: props.measurements.map((m) => [m.measuredAt, m.value]),
          z: 5,
        },
        ...props.forecasts
          .filter((f) => f.status === "available")
          .map((f) => ({
            name: f.model === "linear-all" ? props.allLabel : props.fiveLabel,
            type: "line",
            showSymbol: false,
            lineStyle: { type: "dashed", width: 2 },
            itemStyle: {
              color: f.model === "linear-all" ? "#d88c3d" : "#387cc1",
            },
            data:
              f.status === "available"
                ? f.points.map((p) => [p.at, p.value])
                : [],
          })),
      ],
    },
    true,
  );
}
onMounted(() => {
  if (element.value) {
    chart = init(element.value);
    observer = new ResizeObserver(() => chart?.resize());
    observer.observe(element.value);
    render();
  }
});
watch(() => ({ ...props }), render, { deep: true });
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>
<template>
  <div
    ref="element"
    class="forecast-chart"
    role="img"
    :aria-label="recordedLabel + ' / ' + allLabel + ' / ' + fiveLabel"
  ></div>
</template>
