"use client";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick && onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

export default function DMCMapa({ markers = [], onPick, picked, height = 480, center }) {
  const validos = markers.filter((m) => m.lat && m.lng);
  const c =
    center ||
    (picked && [picked.lat, picked.lng]) ||
    (validos[0] && [validos[0].lat, validos[0].lng]) ||
    [-23.55, -46.63]; // São Paulo como padrão
  const zoom = validos.length || picked ? 11 : 10;

  return (
    <MapContainer
      center={c}
      zoom={zoom}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: "0.9rem", background: "#0a0f12" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      {onPick && <ClickPicker onPick={onPick} />}

      {validos.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={Math.max(8, Math.min(24, Math.sqrt(Number(m.valor_venda) || 0) / 1200))}
          pathOptions={{
            color: m.cor || "#00e7fc",
            fillColor: m.cor || "#00e7fc",
            fillOpacity: 0.55,
            weight: 2,
          }}
          eventHandlers={{ click: () => m.onClick && m.onClick() }}
        >
          <Tooltip direction="top">
            <strong>{m.nome}</strong>
            {m.label ? ` · ${m.label}` : ""}
          </Tooltip>
        </CircleMarker>
      ))}

      {picked && (
        <CircleMarker
          center={[picked.lat, picked.lng]}
          radius={9}
          pathOptions={{ color: "#00ff6a", fillColor: "#00ff6a", fillOpacity: 0.85, weight: 2 }}
        >
          <Tooltip permanent direction="top">
            Local selecionado
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
