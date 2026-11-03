import { useState, type ChangeEvent } from "react";
import { Camera, ChevronLeft, ImagePlus } from "lucide-react";
import "./_group.css";
import "./_settings.css";
import portrait from "./profile-portrait.jpg";
import defaultCover from "./profile-cover.jpg";

const interestOptions = [
  "Fitness",
  "Running",
  "Basketball",
  "Yoga",
  "College life",
  "Nursing",
  "Cybersecurity",
  "Study groups",
  "Gaming",
  "Cars",
  "Music",
  "Photography",
  "Fashion",
  "Food",
  "Tech",
  "Travel",
  "Art & design",
  "Pets",
  "Beauty",
];

export function EditProfile() {
  const [name, setName] = useState("You");
  const [username, setUsername] = useState("you");
  const [email, setEmail] = useState("you@oldtime.app");
  const [bio, setBio] = useState("New on Old Time.");
  const [birthday, setBirthday] = useState("1998-04-12");
  const [city, setCity] = useState("Miami");
  const [interests, setInterests] = useState(["Food", "Travel", "Art & design"]);
  const [photo, setPhoto] = useState(portrait);
  const [cover, setCover] = useState(defaultCover);
  const [customCover, setCustomCover] = useState(false);
  const [notice, setNotice] = useState("");

  const toggleInterest = (interest: string) => {
    setInterests((selected) => {
      if (selected.includes(interest)) return selected.filter((item) => item !== interest);
      if (selected.length >= 8) {
        setNotice("Choose up to 8 interests.");
        return selected;
      }
      return [...selected, interest];
    });
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>, type: "photo" | "cover") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file.");
      event.target.value = "";
      return;
    }
    if (type === "cover" && file.size > 2 * 1024 * 1024) {
      setNotice("Cover images must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === "photo") setPhoto(url);
    else {
      setCover(url);
      setCustomCover(true);
    }
    setNotice("");
  };

  const save = () => {
    if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
      setNotice("Usernames use 3–24 letters, numbers, or underscores.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNotice("Enter a valid email address.");
      return;
    }
    setNotice("Profile saved on this device.");
  };

  return (
    <main className="ot-shell">
      <section className="ot-screen ot-edit" aria-label="Edit profile">
        <header className="ot-screen__header">
          <button className="ot-screen__icon-button" type="button" aria-label="Back to profile" onClick={() => setNotice("You’re still in the profile editor preview.")}>
            <ChevronLeft />
          </button>
          <h1>Edit profile</h1>
          <button className="ot-edit__save" type="button" onClick={save}>Save</button>
        </header>

        <div className="ot-edit__photo-zone">
          <div className="ot-edit__avatar-wrap">
            <img className="ot-edit__avatar" src={photo} alt="Your profile photo" />
            <span className="ot-edit__photo-badge" aria-hidden="true"><Camera /></span>
          </div>
          <label className="ot-edit__change-photo" htmlFor="ot-profile-photo">Edit picture</label>
          <input id="ot-profile-photo" type="file" accept="image/*" onChange={(event) => handleFile(event, "photo")} hidden />
        </div>

        <div style={{ paddingTop: 15 }}>
          <div className="ot-edit__cover">
            <img src={cover} alt="Your profile cover" />
            <label className="ot-edit__cover-label" htmlFor="ot-profile-cover">
              <ImagePlus /> Change cover
            </label>
            <input id="ot-profile-cover" type="file" accept="image/*" onChange={(event) => handleFile(event, "cover")} hidden />
          </div>
          <div className="ot-edit__cover-caption">
            <span>Profile cover</span>
            <button type="button" onClick={() => { setCover(defaultCover); setCustomCover(false); setNotice("Using your automatic cover."); }}>
              {customCover ? "Use automatic cover" : "Automatic cover"}
            </button>
          </div>
        </div>

        <div className="ot-edit__fields">
          {notice && <p className="ot-status" role="status">{notice}</p>}
          <label className="ot-edit__field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Name" />
          </label>
          <label className="ot-edit__field">
            <span>Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} aria-label="Username" autoCapitalize="none" />
            <small className="ot-edit__helper">Your unique Old Time name</small>
          </label>
          <label className="ot-edit__field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email" />
          </label>
          <label className="ot-edit__field">
            <span>Bio</span>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} aria-label="Bio" maxLength={160} />
          </label>
          <label className="ot-edit__field">
            <span>Birthday</span>
            <input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} aria-label="Birthday" />
          </label>
          <label className="ot-edit__field">
            <span>City</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} aria-label="City" />
          </label>

          <section className="ot-edit__interests" aria-labelledby="edit-interests-heading">
            <div className="ot-edit__interests-heading">
              <strong id="edit-interests-heading">Interests</strong>
              <span>{interests.length} of 8 selected</span>
            </div>
            <p className="ot-note">Shared interests help people find something to talk about.</p>
            <div className="ot-edit__interest-grid" role="group" aria-label="Choose up to 8 interests">
              {interestOptions.map((interest) => {
                const selected = interests.includes(interest);
                return (
                  <button
                    type="button"
                    key={interest}
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </section>
          <button className="ot-edit__bottom-save" type="button" onClick={save}>Save profile</button>
        </div>
      </section>
    </main>
  );
}
