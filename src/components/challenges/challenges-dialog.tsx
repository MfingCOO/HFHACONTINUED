'use client';

import { ChallengeList } from './challenge-list';
import { BaseModal } from '@/components/ui/base-modal';

interface ChallengesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChallengesDialog({ isOpen, onClose }: ChallengesDialogProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Community Challenges"
      description="Join group challenges, track your progress, and stay motivated."
    >
      <ChallengeList />
    </BaseModal>
  );
}
