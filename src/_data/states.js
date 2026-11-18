import cities from "./cities.js";

export default function () {
  const grouped = new Map();
  for (const city of cities()) {
    const state = String(city.state || "");
    if (!grouped.has(state)) {
      grouped.set(state, {
        state,
        stateName: city.stateName,
        stateSlug: state.toLowerCase(),
        cities: [],
      });
    }
    grouped.get(state).cities.push(city);
  }
  return [...grouped.values()].sort((a, b) =>
    String(a.stateName || "").localeCompare(String(b.stateName || ""))
  );
}
