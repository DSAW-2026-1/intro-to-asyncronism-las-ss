const API = "https://pokeapi.co/api/v2";

const els = {
  form: document.getElementById("search-form"),
  query: document.getElementById("pokemon-query"),
  btnRandom: document.getElementById("btn-random"),
  status: document.getElementById("status"),
  resultCard: document.getElementById("result-card"),
  img: document.getElementById("pokemon-img"),
  name: document.getElementById("pokemon-name"),
  weight: document.getElementById("pokemon-weight"),
  height: document.getElementById("pokemon-height"),
  types: document.getElementById("pokemon-types"),
  speciesFlavor: document.getElementById("species-flavor"),
  speciesGenus: document.getElementById("species-genus"),
  typeRelations: document.getElementById("type-relations"),
};

/**
 * @param {string} message
 * @param {"idle"|"loading"|"error"|"ok"} kind
 */
function setStatus(message, kind = "idle") {
  els.status.textContent = message;
  els.status.classList.remove("status--error", "status--ok");
  if (kind === "error") els.status.classList.add("status--error");
  if (kind === "ok") els.status.classList.add("status--ok");
}

/**
 * @param {Response} res
 */
async function parseJsonOrThrow(res) {
  const text = await res.text();
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = JSON.parse(text);
      if (err.detail) detail = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Error ${res.status}`);
  }
  return text ? JSON.parse(text) : {};
}

/**
 * Endpoint 1: GET /pokemon/{name or id}
 * @param {string} nameOrId
 */
async function fetchPokemon(nameOrId) {
  const q = encodeURIComponent(String(nameOrId).trim().toLowerCase());
  const res = await fetch(`${API}/pokemon/${q}`);
  return parseJsonOrThrow(res);
}

/**
 * Endpoint 2: species URL from pokemon response
 * @param {string} url
 */
async function fetchByUrl(url) {
  const res = await fetch(url);
  return parseJsonOrThrow(res);
}

/**
 * Endpoint 3: GET /type/{name or id}
 * @param {string} typeName
 */
async function fetchType(typeName) {
  const t = encodeURIComponent(String(typeName).toLowerCase());
  const res = await fetch(`${API}/type/${t}`);
  return parseJsonOrThrow(res);
}

/**
 * PokeAPI: weight in hectograms, height in decimeters
 * @param {number} hg
 */
function formatWeightKg(hg) {
  return `${(hg / 10).toFixed(1)} kg`;
}

/**
 * @param {number} dm
 */
function formatHeightM(dm) {
  return `${(dm / 10).toFixed(1)} m`;
}

/**
 * @param {{ sprites?: object, name: string }} pokemon
 */
function pickSpriteUrl(pokemon) {
  return (
    pokemon.sprites?.other?.["official-artwork"]?.front_default ||
    pokemon.sprites?.front_default ||
    ""
  );
}

/**
 * @param {{ flavor_text_entries?: Array<{ language?: { name?: string }, flavor_text?: string }>, genera?: Array<{ language?: { name?: string }, genus?: string }> }} species
 */
function flavorTextEs(species) {
  const entries = species.flavor_text_entries || [];
  const es = entries.find((e) => e.language?.name === "es");
  const en = entries.find((e) => e.language?.name === "en");
  const text = (es || en)?.flavor_text || "Sin descripción disponible.";
  return text.replace(/\f/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * @param {{ damage_relations?: { double_damage_from?: Array<{ name: string }>, half_damage_from?: Array<{ name: string }> } }} typeData
 */
function summarizeTypeDamage(typeData) {
  const dr = typeData.damage_relations || {};
  const doubleFrom = (dr.double_damage_from || []).map((x) => x.name).join(", ");
  const halfFrom = (dr.half_damage_from || []).map((x) => x.name).join(", ");
  const parts = [];
  if (doubleFrom) parts.push(`Débil frente a: ${doubleFrom}.`);
  if (halfFrom) parts.push(`Resiste: ${halfFrom}.`);
  return parts.length ? parts.join(" ") : "Sin relaciones de daño especiales.";
}

/**
 * @param {object} pokemon - respuesta de /pokemon/{id}
 */
async function loadPokemonBundle(pokemon) {
  const sprite = pickSpriteUrl(pokemon);
  els.img.src = sprite || "";
  els.img.alt = sprite ? `Ilustración de ${pokemon.name}` : "";
  els.name.textContent = pokemon.name;
  els.weight.textContent = formatWeightKg(pokemon.weight);
  els.height.textContent = formatHeightM(pokemon.height);
  els.types.textContent = (pokemon.types || [])
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name)
    .join(", ");

  const speciesUrl = pokemon.species?.url;
  const primaryType = pokemon.types?.[0]?.type?.name;

  const [speciesData, typeData] = await Promise.all([
    speciesUrl ? fetchByUrl(speciesUrl) : Promise.resolve(null),
    primaryType ? fetchType(primaryType) : Promise.resolve(null),
  ]);

  if (speciesData) {
    els.speciesFlavor.textContent = flavorTextEs(speciesData);
    const genus = speciesData.genera?.find((g) => g.language?.name === "es");
    els.speciesGenus.textContent = genus
      ? `Género: ${genus.genus}`
      : "";
  } else {
    els.speciesFlavor.textContent = "—";
    els.speciesGenus.textContent = "";
  }

  if (typeData) {
    els.typeRelations.textContent = summarizeTypeDamage(typeData);
  } else {
    els.typeRelations.textContent = "—";
  }

  els.resultCard.hidden = false;
}

async function runSearch(raw) {
  const q = String(raw).trim();
  if (!q) {
    setStatus("Escribe un nombre o ID.", "error");
    return;
  }

  setStatus("Cargando datos (pokemon → species → type)…", "loading");
  els.btnRandom.disabled = true;
  try {
    const pokemon = await fetchPokemon(q);
    await loadPokemonBundle(pokemon);
    setStatus("Listo: se usaron los endpoints pokemon, pokemon-species y type.", "ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    setStatus(`No se pudo cargar: ${msg}`, "error");
    els.resultCard.hidden = true;
  } finally {
    els.btnRandom.disabled = false;
  }
}

function randomId() {
  // National dex range is large; PokeAPI supports ids beyond 1025 for forms — keep a safe band
  return Math.floor(Math.random() * 1025) + 1;
}

els.form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  runSearch(els.query.value);
});

els.btnRandom.addEventListener("click", async () => {
  els.query.value = String(randomId());
  await runSearch(els.query.value);
});
