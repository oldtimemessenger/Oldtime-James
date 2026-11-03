import "./place-picker.css";
import { requestCloudApi } from "./store.js";
import { hasPlaceMapCoordinates, mountPlacesMap, normalizePlaceSearchResults } from "./places-map.js";

let pickerMap = null;
let postMap = null;
let searchSequence = 0;
let pickerEscapeHandler = null;
let postMapEscapeHandler = null;

export const hasPlaceCoordinates = hasPlaceMapCoordinates;

export function closePlacePicker() {
  if (pickerEscapeHandler) document.removeEventListener("keydown", pickerEscapeHandler);
  pickerEscapeHandler = null;
  pickerMap?.destroy();
  pickerMap = null;
  document.querySelector(".pp-back")?.remove();
}

export function closePlaceMap() {
  if (postMapEscapeHandler) document.removeEventListener("keydown", postMapEscapeHandler);
  postMapEscapeHandler = null;
  postMap?.destroy();
  postMap = null;
  document.querySelector(".pp-map-back")?.remove();
}

export function openPlaceMap(place) {
  closePlacePicker();
  closePlaceMap();
  const back = document.createElement("div");
  back.className = "pp-map-back";
  back.innerHTML = `<section class="pp-map-dialog" role="dialog" aria-modal="true" aria-labelledby="pp-map-title">
    <div class="pp-map-handle" aria-hidden="true"></div>
    <header class="pp-map-header"><div><span>POST LOCATION</span><h2 id="pp-map-title"></h2></div><button type="button" data-map-close aria-label="Close map">×</button></header>
    <div class="pp-map-canvas" data-post-map></div>
    <p class="pp-map-status" role="status"></p>
  </section>`;
  document.body.appendChild(back);
  const title = back.querySelector("#pp-map-title");
  const status = back.querySelector(".pp-map-status");
  const mapHost = back.querySelector("[data-post-map]");
  title.textContent = String(place?.label || "Place");
  back.querySelector("[data-map-close]").onclick = closePlaceMap;
  back.onclick = event => { if (event.target === back) closePlaceMap(); };
  postMapEscapeHandler = event => {
    if (event.key === "Escape" && back.isConnected) closePlaceMap();
  };
  document.addEventListener("keydown", postMapEscapeHandler);

  if (!place?.id || !hasPlaceCoordinates(place)) {
    mapHost.hidden = true;
    status.textContent = "This place name is saved, but this post has no map pin. Choose it from search while editing to add one.";
    return;
  }

  status.textContent = "Loading map…";
  mountPlacesMap(mapHost, { places: [place], selectedId: String(place.id) })
    .then(controller => {
      if (!back.isConnected) {
        controller.destroy();
        return;
      }
      postMap = controller;
      status.textContent = "";
    })
    .catch(() => {
      if (back.isConnected) status.textContent = "The map is unavailable right now. The saved place is still shown above.";
    });
}

export function openPlacePicker({ value = null, onSelect, onRemove, toast = () => {} } = {}) {
  closePlacePicker();
  const back = document.createElement("div");
  back.className = "pp-back";
  back.innerHTML = `<section class="pp-sheet" role="dialog" aria-modal="true" aria-labelledby="pp-title">
    <div class="pp-handle" aria-hidden="true"></div>
    <header class="pp-header"><div><span>ADD TO POST</span><h2 id="pp-title">Choose a place</h2></div><button type="button" data-close aria-label="Close">×</button></header>
    <p class="pp-help">Search a real place and check its pin before adding it.</p>
    <div class="pp-current" hidden><span class="pp-current-pin" aria-hidden="true">●</span><span class="pp-current-label"></span><button type="button" data-rm>Remove</button></div>
    <div class="pp-search-row"><input maxlength="80" placeholder="Search by place name" aria-label="Search by place name" autocomplete="off"><button class="pp-search-button" data-search type="button">Search</button></div>
    <div class="pp-map-wrap"><div class="pp-map-canvas" data-picker-map></div><p class="pp-map-caption" data-map-caption>Search to show place pins on the map.</p></div>
    <div class="pp-results" aria-label="Place search results"></div>
    <p class="pp-note" role="status" aria-live="polite"></p>
    <footer class="pp-actions"><button type="button" class="pp-near" data-near>Nearby</button><span></span><button type="button" class="pp-cancel" data-close>Cancel</button><button class="pp-main" data-use type="button">Use this place</button></footer>
  </section>`;
  document.body.appendChild(back);
  const $ = selector => back.querySelector(selector);
  const input = $("input");
  const resultsNode = $(".pp-results");
  const note = $(".pp-note");
  const current = $(".pp-current");
  const currentLabel = $(".pp-current-label");
  const mapCaption = $("[data-map-caption]");
  const mapHost = $("[data-picker-map]");
  const useButton = $("[data-use]");
  let results = [];
  let place = value ? { ...value } : null;
  let requestId = ++searchSequence;
  let lastQuery = "";

  const renderResults = () => {
    resultsNode.replaceChildren();
    for (const result of results) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pp-result${place?.id === result.id ? " is-selected" : ""}`;
      button.setAttribute("aria-pressed", String(place?.id === result.id));
      const marker = document.createElement("span");
      marker.className = "pp-result-pin";
      marker.textContent = "●";
      const copy = document.createElement("span");
      copy.className = "pp-result-copy";
      const label = document.createElement("b");
      label.textContent = result.label;
      const detail = document.createElement("small");
      detail.textContent = [result.category, result.address].filter(Boolean).join(" · ") ||
        (place?.id === result.id ? "Selected place" : "Choose this place");
      copy.append(label, detail);
      const check = document.createElement("span");
      check.className = "pp-result-check";
      check.textContent = place?.id === result.id ? "✓" : "";
      button.append(marker, copy, check);
      button.onclick = () => selectResult(result);
      resultsNode.append(button);
    }
  };

  const canUse = () => {
    if (!place) return false;
    if (place.source === "osm" && hasPlaceCoordinates(place)) return true;
    return !!value && place.id === value.id && input.value.trim() === String(value.label || "");
  };

  const showCurrent = () => {
    current.hidden = !place;
    currentLabel.textContent = place?.label || "";
    useButton.disabled = !canUse();
    if (place && !hasPlaceCoordinates(place)) {
      mapCaption.textContent = "This saved place has no map pin. Search and select it again to add one.";
    }
  };

  const selectResult = result => {
    place = result;
    input.value = result.label;
    showCurrent();
    renderResults();
    pickerMap?.update(results, result.id);
  };

  const search = async (coords = null) => {
    const query = input.value.trim();
    if (query.length < 2) {
      note.textContent = "Enter at least two letters to search.";
      input.focus();
      return;
    }
    if (query !== lastQuery) place = null;
    lastQuery = query;
    results = [];
    renderResults();
    pickerMap?.update([]);
    showCurrent();
    note.textContent = "Searching places…";
    mapCaption.textContent = "Loading place pins…";
    const currentRequest = ++searchSequence;
    requestId = currentRequest;
    try {
      const location = coords
        ? `&lat=${Number(coords.latitude.toFixed(2))}&lon=${Number(coords.longitude.toFixed(2))}`
        : "";
      const data = await requestCloudApi(`/api/places/search?q=${encodeURIComponent(query)}${location}`);
      if (!back.isConnected || requestId !== currentRequest) return;
      results = normalizePlaceSearchResults(data?.places);
      note.replaceChildren();
      if (data?.attribution?.text) {
        const osmLink = document.createElement("a");
        osmLink.href = data.attribution.url || "https://www.openstreetmap.org/copyright";
        osmLink.target = "_blank";
        osmLink.rel = "noopener noreferrer";
        osmLink.textContent = data.attribution.text;
        const photonLink = document.createElement("a");
        photonLink.href = "https://photon.komoot.io/";
        photonLink.target = "_blank";
        photonLink.rel = "noopener noreferrer";
        photonLink.textContent = "Photon search";
        note.append(osmLink, document.createTextNode(" · "), photonLink);
      }
      if (!results.length) note.textContent = "No named places found. Try a nearby landmark or a more specific name.";
      mapCaption.textContent = results.length
        ? "Tap a pin or result to check the place."
        : "No place pins found for this search.";
      renderResults();
      showCurrent();
      pickerMap?.update(results);
    } catch (error) {
      if (!back.isConnected || requestId !== currentRequest) return;
      note.textContent = error?.message || "Place search is unavailable. Try again.";
      mapCaption.textContent = "The map is still available for saved place pins.";
    }
  };

  const choose = () => {
    if (!canUse()) {
      toast("Select a place from the search results to save its map pin.");
      return;
    }
    onSelect?.(place);
    closePlacePicker();
  };

  if (place) input.value = place.label || "";
  showCurrent();
  renderResults();
  $("[data-search]").onclick = () => search();
  input.oninput = () => {
    if (place && input.value.trim() !== place.label) {
      place = null;
      showCurrent();
      renderResults();
    }
  };
  input.onkeydown = event => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (canUse()) choose();
      else search();
    }
  };
  useButton.onclick = choose;
  $("[data-near]").onclick = () => {
    if (input.value.trim().length < 2) {
      note.textContent = "Enter a place name before searching nearby.";
      input.focus();
      return;
    }
    if (!navigator.geolocation) {
      note.textContent = "Nearby search is unavailable. Search by place name instead.";
      return;
    }
    note.textContent = "Allow location access to search nearby. Your location is not attached to the post.";
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { if (back.isConnected) search(coords); },
      () => { if (back.isConnected) note.textContent = "Location access was not granted. Search by place name instead."; },
      { timeout: 10000, maximumAge: 300000 },
    );
  };
  $("[data-rm]").onclick = () => {
    onRemove?.();
    closePlacePicker();
  };
  back.querySelectorAll("[data-close]").forEach(button => { button.onclick = closePlacePicker; });
  back.onclick = event => { if (event.target === back) closePlacePicker(); };
  pickerEscapeHandler = event => {
    if (event.key === "Escape" && back.isConnected) closePlacePicker();
  };
  document.addEventListener("keydown", pickerEscapeHandler);

  mountPlacesMap(mapHost, {
    draggable:true,
    onMove:point=>{
      if(!place||place.source!=="osm")return;
      place={...place,...point};
      results=results.map(candidate=>candidate.id===place.id?{...candidate,...point}:candidate);
      mapCaption.textContent="Pin adjusted. Choose Use this place to save it.";
      showCurrent();
    },
    places: place && hasPlaceCoordinates(place) ? [place] : [],
    selectedId: place?.id || "",
    onSelect: result => {
      const match = results.find(candidate => candidate.id === result.id);
      if (match) selectResult(match);
    },
  }).then(controller => {
    if (!back.isConnected) {
      controller.destroy();
      return;
    }
    pickerMap?.destroy();
    pickerMap = controller;
    if (results.length) controller.update(results, place?.id || "");
  }).catch(() => {
    if (back.isConnected) {
      mapCaption.textContent = "The map is unavailable. Choose a named search result below.";
      mapHost.hidden = true;
    }
  });
}
