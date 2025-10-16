
import {
  UtensilsCrossed,
  Flame,
  Moon,
  CloudSun,
  Droplet,
  UserCheck,
  Salad,
  Apple,
  Lightbulb,
  Scale,
  Trophy,
  MessageSquare,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import type { UserTier } from '@/types';

export interface EducationalContent {
  id: string;
  title: string;
  icon: LucideIcon;
  what: string;
  how: string;
  why: string;
  requiredTier: UserTier;
}

export const educationalContentLibrary: Record<string, EducationalContent> = {
  nutrition: {
    id: 'nutrition',
    title: 'Nutrition',
    icon: UtensilsCrossed,
    what: 'Log your meals to understand your eating patterns and nutritional intake, focusing on whole foods over ultra-processed ones.',
    how: 'Use the powerful food search to find items, view their UPF score, and add them to your daily log. The app automatically calculates your macro and micronutrient totals for the day.',
    why: 'Consistent logging reveals the direct link between what you eat and how you feel, empowering you to choose foods that increase energy, stabilize mood, and reduce cravings.',
    requiredTier: 'free',
  },
  activity: {
    id: 'activity',
    title: 'Activity',
    icon: Flame,
    what: 'Track any form of joyful movement, from a walk in the park to a structured workout.',
    how: 'Select an activity type, set the duration and intensity, and note how your hunger levels change before and after. This helps you understand your body\'s true energy needs.',
    why: 'Movement is a key regulator of hunger hormones and stress. Tracking activity helps you find the right balance to boost metabolism and mood without triggering compensatory eating.',
    requiredTier: 'free',
  },
  sleep: {
    id: 'sleep',
    title: 'Sleep',
    icon: Moon,
    what: 'Log your nightly sleep duration and quality to see its profound impact on your next-day choices.',
    how: 'Enter your wake-up time, sleep duration, and rate the quality of your sleep. Also note your waking hunger and stress levels to draw clear connections.',
    why: 'Sleep is the foundation. It regulates hunger hormones like ghrelin and leptin. Improving sleep is often the single most effective step to reducing cravings and managing weight.',
    requiredTier: 'free',
  },
  hydration: {
    id: 'hydration',
    title: 'Hydration',
    icon: Droplet,
    what: 'Track your daily water and fluid intake to ensure your body is properly hydrated.',
    how: 'Quickly add your water intake throughout the day using the preset buttons or by entering a custom amount. Set a daily goal and reminders to stay on track.',
    why: 'Thirst is often mistaken for hunger. Proper hydration is critical for managing false hunger signals, boosting metabolism, and improving energy levels.',
    requiredTier: 'free',
  },
  stress: {
    id: 'stress',
    title: 'Stress & Cravings',
    icon: CloudSun,
    what: 'Log moments of high stress or cravings to identify triggers and develop coping strategies.',
    how: 'When you feel stressed or have a craving, log the event, its intensity, and any suspected triggers. If you used a relief strategy, log that too to see what works.',
    why: 'Stress is a primary driver of cravings and emotional eating. By logging these events, you turn them from setbacks into data points, helping the AI identify patterns you can break.',
    requiredTier: 'basic',
  },
  protocol: {
    id: 'protocol',
    title: '75/20/20 Protocol',
    icon: UserCheck,
    what: 'A mindful eating exercise to reconnect with your body\'s natural fullness signals.',
    how: 'Eat 75% of your meal, drink 20oz of water, and then wait 20 minutes. Use the built-in timer and log your pre- and post-meal hunger levels to train your body to recognize satiety.',
    why: 'This powerful technique breaks the habit of overeating by giving your brain and stomach time to communicate. It teaches you to stop eating when you are satisfied, not stuffed.',
    requiredTier: 'basic',
  },
  planner: {
    id: 'planner',
    title: 'Indulgence Planner',
    icon: Salad,
    what: 'Plan for indulgences in a structured way to enjoy them guilt-free and without derailing your progress.',
    how: 'Schedule an upcoming indulgence, noting the occasion. Create a plan for your meals and hydration *before* the event, and a recovery meal for *after*.',
    why: 'Planning removes the guilt and spontaneity that often leads to a binge. It puts you in control, turning a potential setback into a planned, enjoyable part of your life.',
    requiredTier: 'basic',
  },
  cravings: {
    id: 'cravings',
    title: 'Stress & Cravings',
    icon: Apple,
    what: 'Log moments of high stress or cravings to identify triggers and develop coping strategies.',
    how: 'When you feel stressed or have a craving, log the event, its intensity, and any suspected triggers. If you used a relief strategy, log that too to see what works.',
    why: 'Stress is a primary driver of cravings and emotional eating. By logging these events, you turn them from setbacks into data points, helping the AI identify patterns you can break.',
    requiredTier: 'basic',
  },
  insights: {
    id: 'insights',
    title: 'AI Insights',
    icon: Lightbulb,
    what: 'Your personal AI coach that analyzes your data to find hidden patterns and provide actionable advice.',
    how: 'Select a time period (e.g., last 7 days) and click "Generate". The AI will review your logs across all pillars to find the most important connection and give you a specific suggestion.',
    why: 'The AI can see connections you might miss, like how a poor night\'s sleep leads to more sugar cravings two days later. These insights provide the "aha!" moments that accelerate your progress.',
    requiredTier: 'basic',
  },
  measurements: {
    id: 'measurements',
    title: 'Measurements',
    icon: Scale,
    what: 'Track your weight and waist circumference to see long-term trends beyond daily fluctuations.',
    how: 'Enter your weight and waist measurements periodically. The app will automatically calculate your Waist-to-Height Ratio (WtHR), a key health indicator.',
    why: 'Focusing on the trend, not the daily number, provides a truer picture of your progress. Tracking WtHR is a powerful motivator and a better indicator of health than weight alone.',
    requiredTier: 'free',
  },
  challenges: {
    id: 'challenges',
    title: 'Community Challenges',
    icon: Trophy,
    what: 'Join group challenges with fellow users to build consistency and stay motivated.',
    how: 'Browse available challenges, join one that interests you, and complete the daily tasks. Track your progress and streaks alongside the community in a shared chat.',
    why: 'Accountability and community are powerful motivators. Challenges provide a structured way to build new habits and learn from others on the same journey.',
    requiredTier: 'premium',
  },
  chats: {
    id: 'chats',
    title: 'Community Chats',
    icon: MessageSquare,
    what: 'Connect with coaches and other users in group chats for support and motivation.',
    how: 'Join open chats based on topics or challenges. Participate in discussions, ask questions, and share your wins and struggles with the community.',
    why: 'You are not alone. Sharing the journey with others provides support, accountability, and new perspectives, making it easier to stay on track and feel connected.',
    requiredTier: 'premium',
  },
  calendar: {
    id: 'calendar',
    title: 'Calendar',
    icon: Calendar,
    what: 'View all your logged data in a comprehensive calendar view.',
    how: 'See your daily, weekly, and monthly logs at a glance. Click on any day to see a detailed timeline of your activities, meals, and other entries.',
    why: 'The calendar provides a "big picture" view of your habits, making it easy to spot trends, review past successes, and plan for the future.',
    requiredTier: 'free',
  },
};
