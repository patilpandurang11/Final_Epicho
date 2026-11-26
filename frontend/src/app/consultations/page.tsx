"use client";

import React, { useState, useEffect } from "react";
import { 
  HeartHandshake, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Video, 
  Star, 
  Award, 
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ConsultationsPage() {
  const { user } = useAuth();
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Modal
  const [selectedNutritionist, setSelectedNutritionist] = useState<any>(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  const fetchData = async () => {
    try {
      const nuts = await apiRequest("/consultations/nutritionists");
      setNutritionists(nuts);
      if (user) {
        const apps = await apiRequest("/consultations/my-appointments");
        setMyAppointments(apps);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in to book a clinical consultation.");
      window.location.href = "/login";
      return;
    }
    if (!selectedNutritionist || !appointmentDate) return;

    setIsBooking(true);
    try {
      const combinedDateTime = new Date(`${appointmentDate}T${appointmentTime}:00Z`).toISOString();
      await apiRequest("/consultations/book", {
        method: "POST",
        body: JSON.stringify({
          nutritionist_id: selectedNutritionist.user_id,
          appointment_time: combinedDateTime,
          duration_minutes: 45,
          consultation_notes: notes
        })
      });

      alert("Consultation scheduled! Live meeting link generated.");
      setSelectedNutritionist(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to book appointment.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
          <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
          Certified Nutrition Care
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#0F172A] tracking-tight">
          Nutritionist Consultations
        </h1>
        <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
          Book confidential 1-on-1 consultations with verified dietitians and clinical nutritionists. Consent-based DPDP health information sharing.
        </p>
      </div>

      {/* User's Upcoming Appointments if any */}
      {myAppointments.length > 0 && (
        <section className="bg-white rounded-3xl border border-[#F2E6E2] p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#059669]" />
            Your Scheduled Appointments
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myAppointments.map((app) => (
              <div key={app.consultation_id} className="p-4 rounded-2xl bg-[#FFFBEB] border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#9A3412]">
                    With {app.nutritionist_name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase text-[10px]">
                    {app.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-stone-600">
                  <span>📅 {new Date(app.appointment_time).toLocaleDateString()}</span>
                  <span>⏱️ {app.duration_minutes} Mins</span>
                </div>
                {app.meet_link && (
                  <a
                    href={app.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#059669] text-white font-bold text-xs hover:bg-emerald-800 transition-colors mt-1"
                  >
                    <Video className="w-3.5 h-3.5" /> Join Teleconsultation Video Call
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nutritionist Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {nutritionists.map((nut) => (
          <div key={nut.nutritionist_id} className="bg-white rounded-3xl border border-[#F2E6E2] p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-900 font-black text-base flex items-center justify-center">
                  {nut.full_name ? nut.full_name[0] : "D"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-[#0F172A]">{nut.full_name}</h3>
                    {nut.is_verified && <ShieldCheck className="w-4 h-4 text-[#059669]" />}
                  </div>
                  <span className="text-xs text-stone-500 font-medium">{nut.credentials}</span>
                </div>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">{nut.bio}</p>

              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Specializations:</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {nut.specializations?.map((sp: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[10px] font-semibold">
                      {sp}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-400 block font-semibold">Fee:</span>
                <span className="text-base font-black text-[#9A3412]">₹{nut.consultation_fee}</span>
              </div>
              <button
                onClick={() => setSelectedNutritionist(nut)}
                className="px-4 py-2 rounded-xl bg-[#059669] text-white font-bold text-xs hover:bg-emerald-800 transition-colors shadow-sm"
              >
                Book Appointment
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      {selectedNutritionist && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-base">Book Clinical Consultation</h3>
              <button onClick={() => setSelectedNutritionist(null)} className="text-stone-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleBook} className="space-y-3">
              <div className="text-xs text-stone-600">
                Booking with <strong>{selectedNutritionist.full_name}</strong> • ₹{selectedNutritionist.consultation_fee} INR
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Time</label>
                <input
                  type="time"
                  required
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Health Focus / Dietary Goals</label>
                <textarea
                  placeholder="Describe your health goals (e.g. insulin resistance, athletic training, gut health)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedNutritionist(null)}
                  className="flex-1 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBooking}
                  className="flex-1 py-2 rounded-xl bg-[#059669] text-white font-bold text-xs hover:bg-emerald-800"
                >
                  {isBooking ? "Confirming..." : "Confirm & Pay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
