<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onBeforeUnmount,
  ref,
} from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Dialog from "primevue/dialog";
const ForecastChart = defineAsyncComponent(() => import("./ForecastChart.vue"));
import { messages, type Language } from "./i18n";
import type {
  Board,
  BoardSnapshot,
  Forecast,
  ForecastModelId,
  Measurement,
} from "../domain/types";

const language = ref<Language>(
  navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en",
);
const t = computed(() => messages[language.value]);
const locale = computed(() => (language.value === "fr" ? "fr-FR" : "en-GB"));
const boards = ref<Board[]>([]),
  snapshot = ref<BoardSnapshot>(),
  forecasts = ref<Forecast[]>([]);
const busy = ref(false),
  error = ref(""),
  createOpen = ref(false),
  settingsOpen = ref(false),
  resetOpen = ref(false);
const name = ref(""),
  unit = ref("");
const readingValue = ref<number | null>(null),
  readingDate = ref(localTime()),
  editingId = ref<string>();
const horizon = ref(30),
  reference = ref(Date.now());
const latest = computed(() => snapshot.value?.measurements.at(-1));
const models: ForecastModelId[] = ["linear-all", "linear-last-five"];
const label = (m: ForecastModelId) =>
  m === "linear-all" ? t.value.all : t.value.five;
const number = (v: number) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(v);
const date = (v: number) =>
  new Date(v).toLocaleString(locale.value, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function localTime(at = Date.now()) {
  const d = new Date(at);
  return new Date(at - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 23);
}
class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
async function api<T>(
  path: string,
  method = "GET",
  payload?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    headers: {
      "X-Requested-With": "howlongwillitlast",
      ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error?.code ?? "error");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
async function run(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await action();
  } catch (e) {
    const code = e instanceof ApiError ? e.code : "error";
    error.value =
      code === "unauthenticated"
        ? t.value.unauthenticated
        : code === "not-found"
          ? t.value.notFound
          : code === "invalid-input"
            ? t.value.invalid
            : t.value.error;
  } finally {
    busy.value = false;
  }
}
async function loadForecast() {
  if (!snapshot.value) return;
  reference.value = Date.now();
  const first = snapshot.value.measurements[0]?.measuredAt ?? reference.value;
  const start = Math.min(first, reference.value);
  const last = Math.max(
    latest.value?.measuredAt ?? reference.value,
    reference.value,
  );
  const end = last + horizon.value * 86400000;
  const sampleAt = Array.from({ length: 161 }, (_, i) =>
    Math.round(start + ((end - start) * i) / 160),
  );
  forecasts.value = await api<Forecast[]>(
    "/boards/" + snapshot.value.board.id + "/forecast",
    "POST",
    { asOf: reference.value, sampleAt },
  );
}
async function reload() {
  if (!snapshot.value) return;
  snapshot.value = await api<BoardSnapshot>(
    "/boards/" + snapshot.value.board.id,
  );
  await loadForecast();
}
function clearReading() {
  readingValue.value = null;
  readingDate.value = localTime();
  editingId.value = undefined;
}
async function selectBoard(id: string) {
  await run(async () => {
    const next = await api<BoardSnapshot>("/boards/" + id);
    snapshot.value = next;
    forecasts.value = [];
    settingsOpen.value = false;
    clearReading();
    history.replaceState(null, "", "?board=" + encodeURIComponent(id));
    await loadForecast();
  });
}
function goBack() {
  if (busy.value) return;
  snapshot.value = undefined;
  forecasts.value = [];
  error.value = "";
  history.replaceState(null, "", location.pathname);
}
function openCreate() {
  name.value = "";
  unit.value = "";
  createOpen.value = true;
}
async function createBoard() {
  await run(async () => {
    const board = await api<Board>("/boards", "POST", {
      name: name.value,
      unit: unit.value,
      selectedModels: models,
    });
    boards.value.push(board);
    createOpen.value = false;
    snapshot.value = { board, measurements: [] };
    history.replaceState(null, "", "?board=" + encodeURIComponent(board.id));
    clearReading();
    await loadForecast();
  });
}
function openSettings() {
  if (snapshot.value) {
    name.value = snapshot.value.board.name;
    unit.value = snapshot.value.board.unit;
    settingsOpen.value = true;
  }
}
async function saveSettings() {
  await run(async () => {
    if (!snapshot.value) return;
    const board = await api<Board>(
      "/boards/" + snapshot.value.board.id,
      "PUT",
      {
        name: name.value,
        unit: unit.value,
        selectedModels: snapshot.value.board.selectedModels,
      },
    );
    boards.value = boards.value.map((b) => (b.id === board.id ? board : b));
    snapshot.value = { ...snapshot.value, board };
    settingsOpen.value = false;
  });
}
async function toggleModel(model: ForecastModelId, checked: boolean) {
  await run(async () => {
    if (!snapshot.value) return;
    const current = snapshot.value.board;
    const selectedModels = checked
      ? [...current.selectedModels, model]
      : current.selectedModels.filter((m) => m !== model);
    const board = await api<Board>("/boards/" + current.id, "PUT", {
      name: current.name,
      unit: current.unit,
      selectedModels,
    });
    boards.value = boards.value.map((b) => (b.id === board.id ? board : b));
    snapshot.value = { ...snapshot.value, board };
    await loadForecast();
  });
}
async function saveReading() {
  await run(async () => {
    if (!snapshot.value || readingValue.value === null) return;
    const measuredAt = new Date(readingDate.value).getTime();
    if (!Number.isFinite(measuredAt)) throw new ApiError("invalid-input");
    const path =
      "/boards/" +
      snapshot.value.board.id +
      "/measurements" +
      (editingId.value ? "/" + editingId.value : "");
    await api(path, editingId.value ? "PUT" : "POST", {
      value: readingValue.value,
      measuredAt,
    });
    clearReading();
    await reload();
  });
}
function editReading(row: Measurement) {
  editingId.value = row.id;
  readingValue.value = row.value;
  readingDate.value = localTime(row.measuredAt);
  document
    .getElementById("reading-form")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}
async function deleteReading(row: Measurement) {
  if (!window.confirm(t.value.deleteHelp)) return;
  await run(async () => {
    if (!snapshot.value) return;
    await api(
      "/boards/" + snapshot.value.board.id + "/measurements/" + row.id,
      "DELETE",
    );
    if (editingId.value === row.id) clearReading();
    await reload();
  });
}
async function reset() {
  await run(async () => {
    if (!snapshot.value) return;
    await api("/boards/" + snapshot.value.board.id + "/measurements", "DELETE");
    resetOpen.value = false;
    clearReading();
    await reload();
  });
}
function focusRefresh() {
  if (snapshot.value && !busy.value) void run(loadForecast);
}
onMounted(() => {
  void run(async () => {
    boards.value = await api<Board[]>("/boards");
    const id = new URLSearchParams(location.search).get("board");
    if (id) {
      snapshot.value = await api<BoardSnapshot>("/boards/" + id);
      await loadForecast();
    }
  });
  window.addEventListener("focus", focusRefresh);
});
onBeforeUnmount(() => window.removeEventListener("focus", focusRefresh));
</script>

<template>
  <div class="app-shell" :lang="language">
    <header class="topbar">
      <a href="/" class="brand" @click.prevent="goBack"
        ><span class="brand-mark" aria-hidden="true">◷</span
        ><span>HOW LONG<br /><strong>WILL IT LAST?</strong></span></a
      >
      <label class="language"
        ><span class="sr-only">{{ t.language }}</span
        ><select v-model="language">
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select></label
      >
    </header>
    <main :aria-busy="busy">
      <div v-if="error" class="alert" role="alert">{{ error }}</div>
      <p v-if="busy" class="loading" role="status">{{ t.loading }}</p>
      <template v-if="!snapshot">
        <section class="page-heading">
          <div>
            <p class="eyebrow">{{ t.tagline }}</p>
            <h1>{{ t.title }}</h1>
            <p class="subtitle">{{ t.subtitle }}</p>
          </div>
          <Button :label="t.newBoard" :disabled="busy" @click="openCreate" />
        </section>
        <div class="section-title">
          <h2>{{ t.boards }}</h2>
          <span class="badge">{{ boards.length }}</span>
        </div>
        <section v-if="boards.length" class="board-grid">
          <button
            v-for="board in boards"
            :key="board.id"
            class="board-card"
            :disabled="busy"
            @click="selectBoard(board.id)"
          >
            <span class="card-symbol" aria-hidden="true">↘</span>
            <h3>{{ board.name }}</h3>
            <p>{{ board.unit || "—" }}</p>
            <span class="card-arrow" aria-hidden="true">↗</span>
          </button>
        </section>
        <section v-else-if="!busy && !error" class="empty-state">
          <span class="empty-symbol" aria-hidden="true">◴</span>
          <h2>{{ t.empty }}</h2>
          <p>{{ t.emptyHelp }}</p>
          <Button :label="t.newBoard" @click="openCreate" />
        </section>
      </template>
      <template v-else>
        <button class="back-link" :disabled="busy" @click="goBack">
          ← {{ t.back }}
        </button>
        <section class="page-heading detail-heading">
          <div>
            <p class="eyebrow">{{ t.boards }}</p>
            <h1>{{ snapshot.board.name }}</h1>
            <p class="subtitle">
              {{ snapshot.board.unit || "—" }} <span class="dot">·</span>
              {{ snapshot.measurements.length }} {{ t.measurement }}
            </p>
          </div>
          <Button
            :label="t.settings"
            severity="secondary"
            outlined
            :disabled="busy"
            @click="openSettings"
          />
        </section>
        <section class="summary-grid">
          <article class="summary-card current">
            <p class="eyebrow">{{ t.latest }}</p>
            <div class="stat-value">
              {{ latest ? number(latest.value) : "—" }}
              <span>{{ snapshot.board.unit }}</span>
            </div>
            <p class="stat-detail">
              {{ latest ? date(latest.measuredAt) : t.noReadings }}
            </p>
          </article>
          <article
            v-for="forecast in forecasts"
            :key="forecast.model"
            class="summary-card"
            :class="
              forecast.model === 'linear-all' ? 'model-all' : 'model-five'
            "
          >
            <p class="eyebrow">{{ label(forecast.model) }}</p>
            <template v-if="forecast.status === 'insufficient-data'"
              ><h3>{{ t.insufficient }}</h3>
              <p class="stat-detail">{{ t.needTwo }}</p></template
            >
            <template v-else-if="forecast.depletion.status === 'future'"
              ><div class="stat-value">
                {{ Math.ceil(forecast.depletion.remainingMs / 86400000) }}
              </div>
              <p>{{ t.days }}</p>
              <p class="stat-detail">
                {{ t.depletion }} {{ date(forecast.depletion.at) }}
              </p></template
            >
            <template v-else
              ><h3>
                {{
                  forecast.depletion.status === "not-predicted"
                    ? t.notPredicted
                    : t.past
                }}
              </h3>
              <p
                v-if="forecast.depletion.status === 'already-depleted'"
                class="stat-detail"
              >
                {{ date(forecast.depletion.at) }}
              </p></template
            >
          </article>
        </section>
        <section class="panel chart-panel">
          <div class="panel-heading">
            <div>
              <h2>{{ t.projection }}</h2>
              <p>{{ t.projectionHelp }}</p>
            </div>
            <label class="horizon"
              >{{ t.horizon
              }}<select
                v-model.number="horizon"
                :disabled="busy"
                @change="run(loadForecast)"
              >
                <option
                  v-for="days in [7, 30, 90, 365]"
                  :key="days"
                  :value="days"
                >
                  {{ days }} {{ t.daysLabel }}
                </option>
              </select></label
            >
          </div>
          <div class="model-controls">
            <label
              v-for="model in models"
              :key="model"
              :class="model === 'linear-all' ? 'all' : 'five'"
              ><input
                type="checkbox"
                :checked="snapshot.board.selectedModels.includes(model)"
                :disabled="busy"
                @change="
                  toggleModel(
                    model,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />{{ label(model) }}</label
            >
          </div>
          <ForecastChart
            v-if="snapshot.measurements.length"
            :measurements="snapshot.measurements"
            :forecasts="forecasts"
            :all-label="t.all"
            :five-label="t.five"
            :recorded-label="t.recorded"
            :locale="locale"
          />
          <div v-else class="chart-empty">
            <p>{{ t.noReadingsHelp }}</p>
          </div>
          <p v-if="!snapshot.board.selectedModels.length" class="muted">
            {{ t.selectedNone }}
          </p>
          <div class="chart-footer">
            <small>{{ t.reference }} {{ date(reference) }}</small
            ><Button
              :label="t.refresh"
              text
              size="small"
              :disabled="busy"
              @click="run(loadForecast)"
            />
          </div>
        </section>
        <section id="reading-form" class="panel">
          <h2>{{ editingId ? t.editReading : t.add }}</h2>
          <form class="reading-form" @submit.prevent="saveReading">
            <label
              >{{ t.date
              }}<input
                v-model="readingDate"
                type="datetime-local"
                required
                step="0.001"
                :disabled="busy" /></label
            ><Button
              :label="t.now"
              text
              :disabled="busy"
              @click="readingDate = localTime()"
            /><label
              >{{ t.value }} <span class="muted">{{ snapshot.board.unit }}</span
              ><InputNumber
                v-model="readingValue"
                input-id="reading-value"
                :locale="locale"
                :max-fraction-digits="6"
                :min="-1e12"
                :max="1e12"
                :disabled="busy"
                required /></label
            ><Button
              type="submit"
              :label="editingId ? t.save : t.add"
              :disabled="busy"
            /><Button
              v-if="editingId"
              :label="t.cancel"
              severity="secondary"
              text
              :disabled="busy"
              @click="clearReading"
            />
          </form>
        </section>
        <section class="panel readings-panel">
          <div class="panel-heading">
            <h2>{{ t.measurements }}</h2>
            <Button
              :label="t.reset"
              severity="danger"
              text
              size="small"
              :disabled="busy || !snapshot.measurements.length"
              @click="resetOpen = true"
            />
          </div>
          <div v-if="snapshot.measurements.length" class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{{ t.date }}</th>
                  <th>
                    {{ t.value }}
                    <span class="muted">{{ snapshot.board.unit }}</span>
                  </th>
                  <th>
                    <span class="sr-only">{{ t.edit }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in [...snapshot.measurements].reverse()"
                  :key="row.id"
                >
                  <td>{{ date(row.measuredAt) }}</td>
                  <td class="numeric">{{ number(row.value) }}</td>
                  <td class="row-actions">
                    <Button
                      :label="t.edit"
                      text
                      size="small"
                      :disabled="busy"
                      @click="editReading(row)"
                    /><Button
                      :label="t.delete"
                      severity="danger"
                      text
                      size="small"
                      :disabled="busy"
                      @click="deleteReading(row)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="muted">{{ t.noReadings }}</p>
        </section>
      </template>
    </main>
    <footer class="site-footer">
      How Long Will It Last? <span>·</span> {{ t.tagline }}
    </footer>
    <Dialog
      v-model:visible="createOpen"
      modal
      :header="t.newBoard"
      :style="{ width: '28rem', maxWidth: '94vw' }"
      :closable="!busy"
      ><form class="dialog-form" @submit.prevent="createBoard">
        <label
          >{{ t.name
          }}<InputText
            v-model="name"
            :placeholder="t.namePlaceholder"
            maxlength="120"
            required
            :disabled="busy"
            autofocus /></label
        ><label
          >{{ t.unit
          }}<InputText
            v-model="unit"
            :placeholder="t.unitPlaceholder"
            maxlength="40"
            :disabled="busy"
        /></label>
        <div class="dialog-actions">
          <Button
            :label="t.cancel"
            text
            :disabled="busy"
            @click="createOpen = false"
          /><Button
            type="submit"
            :label="t.create"
            :disabled="busy || !name.trim()"
          />
        </div></form
    ></Dialog>
    <Dialog
      v-model:visible="settingsOpen"
      modal
      :header="t.settings"
      :style="{ width: '28rem', maxWidth: '94vw' }"
      :closable="!busy"
      ><form class="dialog-form" @submit.prevent="saveSettings">
        <label
          >{{ t.name
          }}<InputText
            v-model="name"
            maxlength="120"
            required
            :disabled="busy" /></label
        ><label
          >{{ t.unit
          }}<InputText v-model="unit" maxlength="40" :disabled="busy"
        /></label>
        <div class="dialog-actions">
          <Button
            :label="t.cancel"
            text
            :disabled="busy"
            @click="settingsOpen = false"
          /><Button
            type="submit"
            :label="t.save"
            :disabled="busy || !name.trim()"
          />
        </div></form
    ></Dialog>
    <Dialog
      v-model:visible="resetOpen"
      modal
      :header="t.resetTitle"
      :style="{ width: '30rem', maxWidth: '94vw' }"
      :closable="!busy"
      ><p>{{ t.resetHelp }}</p>
      <div class="dialog-actions">
        <Button
          :label="t.cancel"
          text
          :disabled="busy"
          @click="resetOpen = false"
        /><Button
          :label="t.confirmReset"
          severity="danger"
          :disabled="busy"
          @click="reset"
        /></div
    ></Dialog>
  </div>
</template>
