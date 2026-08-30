// Secretary's own profile, plus doctor profile management (should-have).
// The practice can have several doctors — each one is its own document in
// the `doctors` collection (see firestore.js) rather than a single shared
// profile, so patients can pick between them when booking.
import { useEffect, useState } from "react";
import { Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  updateUserProfile,
  getUserById,
  subscribeToDoctors,
  addDoctor,
  updateDoctor,
  deleteDoctor,
} from "../../firebase/firestore";
import SecretaryLayout from "./SecretaryLayout";
import BackButton from "../../components/BackButton";
import Card from "../../components/Card";
import Avatar from "../../components/Avatar";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import EmptyState from "../../components/EmptyState";
import { isValidName, isValidPhone } from "../../utils/validators";

const EMPTY_DOCTOR = {
  name: "",
  specialty: "",
  certifications: "",
  bio: "",
  contact: "",
};

export default function SecretaryProfile() {
  const { currentUser, userRole, userName, logout } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [signupInfo, setSignupInfo] = useState(null); // idNumber/idType
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const [doctors, setDoctors] = useState([]);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState(null); // null = adding
  const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [doctorFormError, setDoctorFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null); // doctor being confirmed for deletion
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    // currentUser.displayName is only set from this point forward for newly
    // registered accounts - userName (from the Firestore user doc, via
    // AuthContext) is the reliable source for everyone, including accounts
    // created before that fix.
    setName(currentUser.displayName || userName || ""); // eslint-disable-line react-hooks/set-state-in-effect -- syncing local form state from the auth user

    getUserById(currentUser.uid).then((data) => {
      if (!data) return;
      setPhone(data.phone || "");
      setSignupInfo({
        idNumber: data.idNumber || "",
        idType: data.idType || "",
        email: data.email || currentUser.email || "",
      });
    });

  }, [currentUser, userName]);

  useEffect(() => {
    const unsub = subscribeToDoctors(setDoctors);
    return () => unsub && unsub();
  }, []);

  async function handleSaveProfile() {
    setProfileMessage("");
    if (!isValidName(name))
      return setProfileMessage("Please enter a valid name.");
    if (!isValidPhone(phone))
      return setProfileMessage("Please enter a valid phone number.");

    setSavingProfile(true);
    try {
      await updateUserProfile(currentUser.uid, { name, phone });
      setProfileMessage("Profile updated.");
    } catch {
      setProfileMessage("Could not save your profile. Please try again.");
    }
    setSavingProfile(false);
  }

  function openAddDoctor() {
    setEditingDoctorId(null);
    setDoctorForm(EMPTY_DOCTOR);
    setDoctorFormError("");
    setDoctorModalOpen(true);
  }

  function openEditDoctor(doc) {
    setEditingDoctorId(doc.id);
    setDoctorForm({
      name: doc.name || "",
      specialty: doc.specialty || "",
      certifications: doc.certifications || "",
      bio: doc.bio || "",
      contact: doc.contact || "",
    });
    setDoctorFormError("");
    setDoctorModalOpen(true);
  }

  function closeDoctorModal() {
    setDoctorModalOpen(false);
    setDoctorFormError("");
  }

  async function handleSaveDoctor() {
    if (!isValidName(doctorForm.name)) {
      setDoctorFormError("Please enter the doctor's name.");
      return;
    }
    setDoctorFormError("");
    setSavingDoctor(true);
    try {
      if (editingDoctorId) {
        await updateDoctor(editingDoctorId, doctorForm);
      } else {
        await addDoctor(doctorForm);
      }
      setDoctorModalOpen(false);
    } catch (error) {
      console.error("Could not save doctor:", error);
      setDoctorFormError("Could not save this doctor. Please try again.");
    }
    setSavingDoctor(false);
  }

  async function handleDeleteDoctor() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoctor(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      console.error("Could not remove doctor:", error);
    }
    setDeleting(false);
  }

  return (
    <SecretaryLayout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
        <BackButton />
        <h1 className="text-2xl font-semibold text-ink -mt-2">My Profile</h1>

        <Card>
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={name || currentUser?.email} size={56} />
            <div>
              <p className="font-medium text-ink">{name || "Secretary"}</p>
              <p className="text-sm text-slate">{currentUser?.email}</p>
              <p className="text-xs text-slate capitalize mt-1">{userRole}</p>
            </div>
          </div>

          {signupInfo && (
            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <div className="bg-mist rounded-xl px-3 py-2">
                <p className="text-xs text-slate">ID / passport number</p>
                <p className="text-ink">{signupInfo.idNumber || "-"}</p>
              </div>
              <div className="bg-mist rounded-xl px-3 py-2">
                <p className="text-xs text-slate">ID type</p>
                <p className="text-ink">
                  {signupInfo.idType === "sa_id"
                    ? "SA ID"
                    : signupInfo.idType === "passport"
                      ? "Passport"
                      : "-"}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate mb-1 block">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate mb-1 block">
                Phone number
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            {profileMessage && (
              <p className="text-sm text-slate">{profileMessage}</p>
            )}
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">Doctors</h2>
            <Button size="sm" onClick={openAddDoctor}>
              <span className="flex items-center gap-1.5">
                <Plus size={16} /> Add doctor
              </span>
            </Button>
          </div>

          {doctors.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctors yet"
              message="Add a doctor so patients can see who they're booking with."
              actionLabel="Add doctor"
              onAction={openAddDoctor}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="border border-sand rounded-xl p-4 flex items-start gap-3"
                >
                  <Avatar name={doc.name || "Doctor"} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">
                      {doc.name || "Unnamed doctor"}
                    </p>
                    {doc.certifications && (
                      <p className="text-xs text-slate">{doc.certifications}</p>
                    )}
                    {doc.specialty && (
                      <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-blush text-plum text-xs font-medium">
                        {doc.specialty}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditDoctor(doc)}
                      aria-label={`Edit ${doc.name || "doctor"}`}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-slate hover:text-ink hover:bg-mist transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      aria-label={`Remove ${doc.name || "doctor"}`}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-slate hover:text-red hover:bg-pastel-red transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Add / edit doctor */}
      <Modal
        isOpen={doctorModalOpen}
        onClose={closeDoctorModal}
        title={editingDoctorId ? "Edit doctor" : "Add doctor"}
        hideFooter
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-slate mb-1 block">
              Doctor's name
            </label>
            <input
              value={doctorForm.name}
              onChange={(e) =>
                setDoctorForm({ ...doctorForm, name: e.target.value })
              }
              placeholder="e.g. Dr. Nkosi"
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate mb-1 block">
              Certifications
            </label>
            <input
              value={doctorForm.certifications}
              onChange={(e) =>
                setDoctorForm({ ...doctorForm, certifications: e.target.value })
              }
              placeholder="e.g. MBChB, HPCSA registered"
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate mb-1 block">Specialty</label>
            <input
              value={doctorForm.specialty}
              onChange={(e) =>
                setDoctorForm({ ...doctorForm, specialty: e.target.value })
              }
              placeholder="e.g. Infectious Diseases & Nephrology"
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate mb-1 block">Bio</label>
            <textarea
              value={doctorForm.bio}
              onChange={(e) =>
                setDoctorForm({ ...doctorForm, bio: e.target.value })
              }
              rows={5}
              placeholder="A few sentences on experience, approach, and areas of focus"
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate mb-1 block">
              Contact info
            </label>
            <input
              value={doctorForm.contact}
              onChange={(e) =>
                setDoctorForm({ ...doctorForm, contact: e.target.value })
              }
              placeholder="Practice phone or email"
              className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>
          {doctorFormError && (
            <p className="text-red text-sm">{doctorFormError}</p>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={handleSaveDoctor} disabled={savingDoctor}>
              {savingDoctor
                ? "Saving..."
                : editingDoctorId
                  ? "Save changes"
                  : "Add doctor"}
            </Button>
            <Button variant="secondary" onClick={closeDoctorModal}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove doctor confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove doctor?"
        confirmLabel={deleting ? "Removing..." : "Remove doctor"}
        confirmVariant="danger"
        onConfirm={handleDeleteDoctor}
        confirmDisabled={deleting}
      >
        <p className="text-sm text-slate">
          {deleteTarget?.name || "This doctor"} will no longer appear for
          patients to book with. Past appointments already booked with them
          are not affected.
        </p>
      </Modal>
    </SecretaryLayout>
  );
}
