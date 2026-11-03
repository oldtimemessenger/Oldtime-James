import { openFreeMapProvider } from "./sports-vector-style.js";

const MAP_SOURCE = "oldtime-places";
const FALLBACK_CENTER = [-98.5795, 39.8283];

const coordinateNumber = value =>
  value !== null && value !== undefined &&
  !(typeof value === "string" && value.trim() === "")
    ? Number(value)
    : Number.NaN;

const coordinates = place => {
  const lat = coordinateNumber(place?.lat), lon = coordinateNumber(place?.lon);
  return Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    Number.isFinite(lon) && Math.abs(lon) <= 180 ? [lon, lat] : null;
};

export function hasPlaceMapCoordinates(place) {
  return coordinates(place) !== null;
}

export function normalizePlaceSearchResults(places) {
  return (Array.isArray(places) ? places : [])
    .filter(place => place?.id && String(place.label || "").trim() && hasPlaceMapCoordinates(place))
    .map(place => ({
      id: String(place.id),
      label: String(place.label).trim(),
      source: "osm",
      lat: coordinateNumber(place.lat),
      lon: coordinateNumber(place.lon),
    }));
}

export function placesFeatureCollection(places = [], selectedId = "") {
  const seen = new Set();
  const features = [];
  for (const place of Array.isArray(places) ? places : []) {
    const point = coordinates(place);
    const id = String(place?.id || "");
    const label = String(place?.label || "").trim();
    if (!point || !id || !label || seen.has(id)) continue;
    seen.add(id);
    features.push({
      type: "Feature",
      id,
      properties: {
        placeId: id,
        category: place.category || "",
        address: place.address || "",
        label: label.slice(0, 140),
        source: place?.source === "osm" ? "osm" : "custom",
        selected: id === selectedId,
      },
      geometry: { type: "Point", coordinates: point },
    });
  }
  return { type: "FeatureCollection", features };
}

async function loadMapLibre() {
  const [module, , worker] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl.css"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
  ]);
  const maplibre = module.default || module;
  if (worker?.default && maplibre.setWorkerUrl) maplibre.setWorkerUrl(worker.default);
  return maplibre;
}

export function initialPlaceMapView(places, selectedId = "") {
  const collection = placesFeatureCollection(places, selectedId);
  const selected = collection.features.find(feature => feature.properties.selected);
  const first = selected || collection.features[0];
  return first
    ? { center: first.geometry.coordinates, zoom: selected ? 15 : 12, selected: Boolean(selected) }
    : { center: FALLBACK_CENTER, zoom: 3.2 };
}

function fitPlaces(map, maplibre, places, selectedId) {
  const collection = placesFeatureCollection(places, selectedId);
  const selected = collection.features.find(feature => feature.properties.selected);
  if (selected) {
    map.easeTo({ center: selected.geometry.coordinates, zoom: Math.max(14, map.getZoom()), duration: 250 });
    return;
  }
  if (collection.features.length === 1) {
    map.easeTo({ center: collection.features[0].geometry.coordinates, zoom: 13, duration: 250 });
    return;
  }
  if (collection.features.length > 1) {
    const bounds = new maplibre.LngLatBounds();
    collection.features.forEach(feature => bounds.extend(feature.geometry.coordinates));
    map.fitBounds(bounds, { padding: 42, maxZoom: 12, duration: 250 });
  }
}

export async function mountPlacesMap(host, {
  places = [],
  selectedId = "",
  onSelect = () => {},
  draggable = false,
  onMove = () => {},
} = {}) {
  if (!host) throw new Error("There is no place map container.");
  const [maplibre, style] = await Promise.all([
    loadMapLibre(),
    openFreeMapProvider.load("light"),
  ]);
  if (!host.isConnected) throw new Error("The place map was closed before it could load.");

  const view = initialPlaceMapView(places, selectedId);
  const map = new maplibre.Map({
    container: host,
    style,
    center: view.center,
    zoom: view.zoom,
    minZoom: 2,
    maxZoom: 19,
    attributionControl: false,
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false,
    fadeDuration: 120,
  });
  let destroyed = false;
  let loaded = false;
  let dragMarker=null,activePlaces=places,activeId=selectedId;
  const pinSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40"><path fill="#168548" stroke="#fff" stroke-width="2" d="M16 1C7.8 1 2 7 2 15c0 10 14 23 14 23s14-13 14-23C30 7 24.2 1 16 1Z"/><circle cx="16" cy="15" r="5" fill="#fff"/></svg>';
  const syncDragMarker=()=>{
    if(!draggable)return;
    const place=activePlaces.map(p=>p.place||p).find(p=>p.id===activeId);
    const point=place&&coordinates(place);
    if(!point){dragMarker?.remove();dragMarker=null;return;}
    if(!dragMarker){
      const element=document.createElement("button");
      element.type="button";element.setAttribute("aria-label","Drag to adjust this place’s pin");
      element.style.cssText="width:36px;height:45px;padding:0;border:0;background:transparent;cursor:grab";
      element.innerHTML=pinSvg;
      dragMarker=new maplibre.Marker({element,anchor:"bottom",draggable:true}).setLngLat(point).addTo(map);
      const moved=()=>{const p=dragMarker.getLngLat();onMove({lat:p.lat,lon:((p.lng+180)%360+360)%360-180});};
      dragMarker.on("dragend",moved);
      element.addEventListener("keydown",event=>{
        const step={ArrowLeft:[-.0001,0],ArrowRight:[.0001,0],ArrowUp:[0,.0001],ArrowDown:[0,-.0001]}[event.key];
        if(!step)return;event.preventDefault();event.stopPropagation();
        const p=dragMarker.getLngLat();dragMarker.setLngLat([p.lng+step[0],Math.max(-90,Math.min(90,p.lat+step[1]))]);moved();
      });
    }else dragMarker.setLngLat(point);
  };
  let settled = false;

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => fail(new Error("The map is taking too long to load.")), 10000);
    const fail = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      map.remove();
      reject(error);
    };
    map.once("load", () => {
      if (settled || destroyed) return;
      loaded = true;
      settled = true;
      clearTimeout(timer);
      map.addSource(MAP_SOURCE, {
        type: "geojson",
        data: placesFeatureCollection(places, selectedId),
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 42,
      });
      map.addLayer({
        id: `${MAP_SOURCE}-clusters`,
        type: "circle",
        source: MAP_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#168548",
          "circle-radius": ["step", ["get", "point_count"], 16, 8, 20, 20, 24],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: `${MAP_SOURCE}-cluster-count`,
        type: "symbol",
        source: MAP_SOURCE,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
        paint: { "text-color": "#ffffff" },
      });
      const canvas=document.createElement("canvas");canvas.width=64;canvas.height=80;
      const context=canvas.getContext("2d");
      context.scale(2,2);context.fillStyle="#168548";context.strokeStyle="#fff";context.lineWidth=2;
      const pin=new Path2D("M16 1C7.8 1 2 7 2 15c0 10 14 23 14 23s14-13 14-23C30 7 24.2 1 16 1Z");
      context.fill(pin);context.stroke(pin);context.beginPath();context.arc(16,15,5,0,Math.PI*2);context.fillStyle="#fff";context.fill();
      map.addImage("oldtime-place-pin",context.getImageData(0,0,64,80),{pixelRatio:2});
      map.addLayer({
        id: `${MAP_SOURCE}-points`,
        type: "symbol",
        source: MAP_SOURCE,
        filter: ["!", ["has", "point_count"]],
        layout:{"icon-image":"oldtime-place-pin","icon-anchor":"bottom","icon-size":["case",["get","selected"],1.15,.8],"icon-allow-overlap":true},
        paint:{"icon-opacity":draggable?["case",["get","selected"],0,1]:1},
      });
      syncDragMarker();
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibre.AttributionControl({ compact: false }), "bottom-right");
      map.on("click", `${MAP_SOURCE}-clusters`, event => {
        const cluster = map.queryRenderedFeatures(event.point, { layers: [`${MAP_SOURCE}-clusters`] })[0];
        if (!cluster) return;
        const source = map.getSource(MAP_SOURCE);
        source.getClusterExpansionZoom(cluster.properties.cluster_id).then(zoom => {
          if (!destroyed) map.easeTo({ center: cluster.geometry.coordinates, zoom, duration: 250 });
        }).catch(() => {});
      });
      map.on("click", `${MAP_SOURCE}-points`, event => {
        const feature = map.queryRenderedFeatures(event.point, { layers: [`${MAP_SOURCE}-points`] })[0];
        if (!feature) return;
        const point = feature.geometry.coordinates;
        onSelect({
          id: String(feature.properties.placeId),
          label: String(feature.properties.label),
          source: feature.properties.source === "osm" ? "osm" : "custom",
          category: String(feature.properties.category || ""),
          address: String(feature.properties.address || ""),
          lon: point[0],
          lat: point[1],
        });
      });
      for (const layer of [`${MAP_SOURCE}-clusters`, `${MAP_SOURCE}-points`]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
      if (placesFeatureCollection(places, selectedId).features.length > 1) {
        fitPlaces(map, maplibre, places, selectedId);
      }
      requestAnimationFrame(() => { if (!destroyed) map.resize(); });
      resolve();
    });
    map.on("error", event => {
      if (!loaded && event?.error) fail(new Error("The map could not load. Search and list selection are still available."));
    });
  });

  try {
    await ready;
  } catch (error) {
    if (!destroyed) host.dataset.mapError = "true";
    throw error;
  }

  return {
    update(nextPlaces = [], nextSelectedId = "") {
      if (destroyed || !map.isStyleLoaded()) return;
      const source = map.getSource(MAP_SOURCE);
      source?.setData(placesFeatureCollection(nextPlaces, nextSelectedId));
      activePlaces=nextPlaces;activeId=nextSelectedId;syncDragMarker();
      fitPlaces(map, maplibre, nextPlaces, nextSelectedId);
    },
    resize() { if (!destroyed) map.resize(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      dragMarker?.remove();
      map.remove();
    },
  };
}
