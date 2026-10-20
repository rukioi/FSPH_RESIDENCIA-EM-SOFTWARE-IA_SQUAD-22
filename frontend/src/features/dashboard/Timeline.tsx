import { useRef, ComponentProps } from "react";
import "../../app/Timeline.css";

export type TimelineEvent = {
  id: string;
  time: string;
  description: string;
};

const defaultEvents: TimelineEvent[] = [
  { id: "approval-1022", time: "09:42", description: "#TRP-1022 aprovado" },
  { id: "driver-1021", time: "09:20", description: "Motorista atribuído ao #TRP-1021" },
  { id: "completed-1018", time: "09:05", description: "Viagem #TRP-1018 concluída" },
  { id: "maintenance-vf04", time: "08:45", description: "VF-04 colocado em manutenção" },
];

type TimelineProps = {
  title?: string;
  events?: TimelineEvent[];
  onVerTodas?: () => void;
  className?: string;
};

function ActivityButton({ className = "", ...props }: ComponentProps<"button">) {
  return <button type="button" className={`timeline-button ${className}`} {...props} />;
}

function EventList({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="timeline-empty">Nenhuma atividade registrada.</p>;
  }

  return (
    <ol className="timeline-list" aria-label="Eventos recentes">
      {events.map((event) => (
        <li className="timeline-event" key={event.id}>
          <time className="timeline-time" dateTime={event.time}>
            {event.time}
          </time>
          <span className="timeline-track" aria-hidden="true">
            <span className="timeline-dot" />
          </span>
          <p className="timeline-description">{event.description}</p>
        </li>
      ))}
    </ol>
  );
}

export default function Timeline({
  title = "Atividade recente",
  events = defaultEvents,
  onVerTodas,
  className = "",
}: TimelineProps) {

  const dialogRef = useRef<any>(null);

  const handleVerTodas = () => {
    if (onVerTodas) {
      onVerTodas();
      return;
    }

    if (dialogRef.current && typeof dialogRef.current.showModal === "function") {
      dialogRef.current.showModal();
    }
  };

  const closeDialog = () => {
    if (dialogRef.current && typeof dialogRef.current.close === "function") {
      dialogRef.current.close();
    }
  };

  return (
    <section className={`timeline-card ${className}`.trim()} aria-label={title}>
      <header className="timeline-header">
        <h2 className="timeline-title">{title}</h2>
        <ActivityButton
          onClick={handleVerTodas}
          aria-haspopup={onVerTodas ? undefined : ("dialog" as any)}
        >
          Ver todas
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12h15M12 5l7 7-7 7" />
          </svg>
        </ActivityButton>
      </header>

      <EventList events={events} />

      {!onVerTodas && (
        <dialog
          className="timeline-dialog"
          ref={dialogRef}
          aria-label={`${title} — lista completa`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <header className="timeline-header">
            <h3 className="timeline-title">{title}</h3>
            <ActivityButton
              className="timeline-close"
              aria-label="Fechar"
              title="Fechar"
              onClick={closeDialog}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </ActivityButton>
          </header>
          <EventList events={events} />
        </dialog>
      )}
    </section>
  );
}
