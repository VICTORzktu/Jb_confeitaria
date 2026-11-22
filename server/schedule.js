'use strict';
const { weekday: localWeekday, todayISO } = require('./time');
/* Distribuição dos dias de treino na semana.
   Escolhe dias espaçados conforme a frequência (2 a 7) e evita dias consecutivos quando possível. */
const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DISTRIBUTIONS = {
  1: [3],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 4, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function weekdayForIndex(index, total) {
  const dist = DISTRIBUTIONS[Math.min(7, Math.max(1, total))] || DISTRIBUTIONS[4];
  return dist[index % dist.length];
}

/* Retorna [{day, weekday_index, weekday_name, day_label}] */
function scheduleSlots(weeklySchedule) {
  const total = weeklySchedule.length;
  return weeklySchedule.map((d, i) => {
    const wd = weekdayForIndex(i, total);
    return { day: d.day, weekday_index: wd, weekday_name: WEEKDAY_NAMES[wd], day_label: d.day_label || WEEKDAY_NAMES[wd], workout: d };
  });
}

function todayWorkout(planJson) {
  if (!planJson?.weekly_schedule?.length) return null;
  const slots = scheduleSlots(planJson.weekly_schedule);
  const today = localWeekday();
  const idx = slots.findIndex((s) => s.weekday_index === today);
  if (idx === -1) return null;
  return { index: idx, ...slots[idx], workout: planJson.weekly_schedule[idx] || null };
}

function nextWorkout(planJson) {
  if (!planJson?.weekly_schedule?.length) return null;
  const slots = scheduleSlots(planJson.weekly_schedule);
  const today = localWeekday();
  for (let offset = 0; offset < 8; offset++) {
    const wd = (today + offset) % 7;
    const idx = slots.findIndex((s) => s.weekday_index === wd);
    if (idx !== -1) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return { index: idx, ...slots[idx], workout: planJson.weekly_schedule[idx] || null, date: todayISO(date), offset };
    }
  }
  return null;
}

module.exports = { WEEKDAY_NAMES, WEEKDAY_SHORT, scheduleSlots, todayWorkout, nextWorkout, weekdayForIndex };
