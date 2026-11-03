import "./_group.css";
import portrait from "../oldtime-settings/profile-portrait.jpg";

function MoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>;
}

function PencilIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.8-.8 4 4-.8L20 7.2a2.1 2.1 0 0 0-3-3L4 16.8Z" /><path d="m14.8 6.4 2.8 2.8" /></svg>;
}

function PictureIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="13" height="15" rx="2" /><path d="M7 5V3h14v14h-5" /><circle cx="9" cy="10" r="1.2" /><path d="m4 16 4-4 3 3 2-2 3 3" /></svg>;
}

export default function PictureActionsMenu() {
  return (
    <main className="ot-preview ot-picture-preview">
      <article className="ot-picture-card">
        <img className="ot-picture-photo" src={portrait} alt="Sample profile post" />
        <details className="ot-picture-menu" open>
          <summary aria-label="Post actions"><MoreIcon /></summary>
          <div className="ot-picture-menu-items" role="menu" aria-label="Post actions">
            <button type="button" role="menuitem"><PencilIcon />Edit post</button>
            <button type="button" role="menuitem"><PictureIcon />Set as profile cover</button>
          </div>
        </details>
      </article>
    </main>
  );
}
