
import { UtensilsCrossed, Droplet, Flame, Star, CloudSun, UserCheck, Salad, Apple, Lightbulb, Scale, HeartCrack, Moon, Trophy, Users } from 'lucide-react';

export const pillarsAndTools = [
  { id: 'nutrition', label: 'Nutrition', icon: UtensilsCrossed, color: 'text-amber-500', bgColor: 'bg-amber-100/50', borderColor: 'border-amber-300', quote: "Whole foods satisfy soulfully—protein for lasting fullness. ~Alan Roberts" },
  { id: 'activity', label: 'Activity', icon: Flame, color: 'text-orange-500', bgColor: 'bg-orange-100/50', borderColor: 'border-orange-300', quote: "Joyful movement ignites energy—walk to natural joy. ~Alan Roberts" },
  { id: 'sleep', label: 'Sleep', icon: Moon, color: 'text-indigo-500', bgColor: 'bg-indigo-100/50', borderColor: 'border-indigo-300', quote: "Sleep restores your body's wisdom—rest for effortless control. ~Alan Roberts" },
  { id
: 'stress', label: 'Stress Relief', icon: CloudSun, color: 'text-green-500', bgColor: 'bg-green-100/50', borderColor: 'border-green-300', quote: "Stress relief is your shield—breathe to reclaim calm. ~Alan Roberts" },
  { id: 'hydration', label: 'Hydration', icon: Droplet, color: 'text-blue-500', bgColor: 'bg-blue-100/50', borderColor: 'border-blue-300', quote: "Hydration quiets false hunger—small sips build big balance. ~Alan Roberts" },
  { id: 'protocol', label: '75/20/20 Protocol', icon: UserCheck, color: 'text-teal-500', bgColor: 'bg-teal-100/50', borderColor: 'border-teal-300', quote: "Pause for true fullness. ~Alan Roberts" },
  { id: 'planner', label: 'Indulgence Planner', icon: Salad, color: 'text-lime-500', bgColor: 'bg-lime-100/50', borderColor: 'border-lime-300', quote: "Joy without guilt. ~Alan Roberts" },
  { id: 'cravings', label: 'Cravings/Binges', icon: Apple, color: 'text-red-500', bgColor: 'bg-red-100/50', borderColor: 'border-red-300', quote: "Signals to learn from. ~Alan Roberts" },
  { id: 'insights', label: 'Insights', icon: Lightbulb, color: 'text-yellow-500', bgColor: 'bg-yellow-100/50', borderColor: 'border-yellow-300', quote: "Learn from patterns—adjust without struggle for growth. ~Alan Roberts" },
  { id: 'measurements', label: 'Measurements', icon: Scale, color: 'text-gray-500', bgColor: 'bg-gray-100/50', borderColor: 'border-gray-300', quote: "Celebrate consistency—each day a victory in balance. ~Alan Roberts" },
];

// This is the new centralized blueprint for all calendar display logic.
export const pillarDetails: Record<string, { icon: React.ElementType, getTitle: (entry: any) => string }> = {
    nutrition: {
        icon: UtensilsCrossed,
        getTitle: (entry) => entry.mealType ? `${entry.mealType.charAt(0).toUpperCase() + entry.mealType.slice(1)}` : 'Meal',
    },
    activity: {
        icon: Flame,
        getTitle: (entry) => 'Activity', // Always generic
    },
    sleep: {
        icon: Moon,
        getTitle: (entry) => typeof entry.duration === 'number' ? `${entry.duration.toFixed(1)}hr Sleep` : 'Sleep',
    },
    'sleep-nap': {
        icon: Moon,
        getTitle: (entry) => typeof entry.duration === 'number' ? `${entry.duration.toFixed(1)}hr Nap` : 'Nap',
    },
    hydration: {
        icon: Droplet,
        getTitle: (entry) => entry.amount ? `${entry.amount}oz Water` : 'Hydration',
    },
    stress: {
        icon: HeartCrack,
        getTitle: (entry) => 'Stress Event',
    },
    relief: {
        icon: CloudSun,
        getTitle: (entry) => entry.strategy || 'Stress Relief',
    },
    measurements: {
        icon: Scale,
        getTitle: (entry) => 'Measurements',
    },
    protocol: {
        icon: UserCheck,
        getTitle: (entry) => 'Protocol Logged',
    },
    planner: {
        icon: Salad,
        getTitle: (entry) => entry.plannedIndulgence ? `Planned: ${entry.plannedIndulgence}` : 'Indulgence',
    },
    craving: {
        icon: Apple,
        getTitle: (entry) => entry.craving || 'Craving Logged',
    },
    binge: {
        icon: Apple,
        getTitle: (entry) => 'Binge Event',
    },
    habit: {
        icon: Trophy,
        getTitle: (entry) => entry.title ? `Challenge: ${entry.title}` : 'Challenge Habit',
    },
    appointment: {
        icon: Users,
        getTitle: (entry) => entry.title || 'Appointment',
    },
    default: {
        icon: Star,
        getTitle: (entry) => entry.pillar ? entry.pillar.charAt(0).toUpperCase() + entry.pillar.slice(1) : 'Log',
    }
};



