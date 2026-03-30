import { Injectable, Logger } from '@nestjs/common';
import {
  CreateLawScheduleDto,
  LawActivityDto,
  LawUserDto,
  LawResourceDto,
  HardConstraintType,
  SoftConstraintType,
} from './dto/law-schedule.dto';

export interface ScheduledActivity {
  activityId: string;
  activityName: string;
  date: string;
  startTime: string;
  endTime: string;
  assignedUsers: string[];
  assignedResources: string[];
  warnings: string[];
  score: number;
}

export interface ScheduleResult {
  scheduled: ScheduledActivity[];
  unscheduled: { activityId: string; reason: string }[];
  metrics: {
    totalActivities: number;
    scheduledCount: number;
    unscheduledCount: number;
    score: number;
  };
}

@Injectable()
export class LawSchedulerService {
  private readonly logger = new Logger(LawSchedulerService.name);

  public generateSchedule(input: CreateLawScheduleDto): ScheduleResult {
    const { timeConfig, users, resources, activities, constraints, optimization } = input;
    const strategy = optimization?.strategy || 'greedy';

    this.logger.log(`Starting scheduling with strategy: ${strategy}`);

    if (strategy === 'backtracking') {
      return this.scheduleWithBacktracking(input);
    }

    // Default to Greedy strategy
    return this.scheduleGreedy(input);
  }

  private scheduleGreedy(input: CreateLawScheduleDto): ScheduleResult {
    const { timeConfig, users, resources, activities, constraints } = input;
    
    const result: ScheduleResult = {
      scheduled: [],
      unscheduled: [],
      metrics: { totalActivities: activities.length, scheduledCount: 0, unscheduledCount: 0, score: 0 }
    };

    // 1. Generate available general slots based on timeConfig
    const availableDates = this.generateDatesList(timeConfig.startDate, timeConfig.endDate, timeConfig.workingDays, timeConfig.holidays || []);
    
    // Sort activities by priority (e.g. fixedTime first, duration descending)
    const sortedActivities = [...activities].sort((a, b) => {
      if (a.fixedTime && !b.fixedTime) return -1;
      if (!a.fixedTime && b.fixedTime) return 1;
      return b.duration - a.duration; // Larger chunks first
    });

    for (const activity of sortedActivities) {
      let isScheduled = false;

      // 2. Iterate through possible dates and timeslots
      for (const date of availableDates) {
        if (isScheduled) break;
        const dayOfWeek = new Date(date).getDay() || 7; // 1-7 (Mon-Sun)

        for (const slot of timeConfig.timeSlots) {
          if (isScheduled) break;

          // Check required users and resources for this slot
          const assignedUserIds = this.findAvailableUsers(users, activity, date, dayOfWeek, slot.start, slot.end, result.scheduled, constraints?.hard);
          const assignedResourceIds = this.findAvailableResources(resources, activity, date, dayOfWeek, slot.start, slot.end, result.scheduled, constraints?.hard);

          if (assignedUserIds.length >= (activity.requiredUsers || 1) && 
              (!activity.requiredResources?.length || assignedResourceIds.length >= activity.requiredResources.length)) {
            
            // Generate basic end time based on duration (assuming duration fits in slot for simplicity here)
            const endTime = this.calculateEndTime(slot.start, activity.duration);

            // Calculate soft constraint score
            let score = 0;
            const warnings = [];
            
            if (constraints?.soft) {
               for (const soft of constraints.soft) {
                 if (soft.type === SoftConstraintType.PREFER_MORNING && parseInt(slot.start.split(':')[0]) < 12) {
                    score += soft.weight;
                 }
               }
            }

            result.scheduled.push({
              activityId: activity.id,
              activityName: activity.name,
              date,
              startTime: slot.start,
              endTime: endTime,
              assignedUsers: assignedUserIds,
              assignedResources: assignedResourceIds,
              warnings,
              score
            });
            result.metrics.score += score;
            isScheduled = true;
          }
        }
      }

      if (!isScheduled) {
        result.unscheduled.push({ activityId: activity.id, reason: 'No available slots matching constraints (users/resources busy or unavailable)' });
      }
    }

    result.metrics.scheduledCount = result.scheduled.length;
    result.metrics.unscheduledCount = result.unscheduled.length;
    
    return result;
  }

  private scheduleWithBacktracking(input: CreateLawScheduleDto): ScheduleResult {
     this.logger.log('Backtracking algorithm is a WIP. Falling back to greedy.');
     // In a real implementation, this would use recursion to find the absolute optimal valid schedule.
     return this.scheduleGreedy(input);
  }

  private findAvailableUsers(
    users: LawUserDto[],
    activity: LawActivityDto,
    date: string,
    dayOfWeek: number,
    start: string,
    end: string,
    alreadyScheduled: ScheduledActivity[],
    hardConstraints: HardConstraintType[] = []
  ): string[] {
    const requiredLimit = activity.requiredUsers || 1;
    let selected: string[] = [];

    // Filter to those having required skills
    const qualifiedUsers = users.filter(u => {
       if (activity.requiredSkills && activity.requiredSkills.length > 0) {
          return activity.requiredSkills.every(reqSkill => u.skills?.includes(reqSkill));
       }
       return true;
    });

    for (const user of qualifiedUsers) {
      if (selected.length >= requiredLimit) break;

      // 1. check respect_availability (if constraint is active)
      if (hardConstraints.includes(HardConstraintType.RESPECT_AVAILABILITY) && user.availability && user.availability.length > 0) {
          const isAvail = user.availability.some(avail => avail.day === dayOfWeek && avail.start <= start && avail.end >= end);
          if (!isAvail) continue;
      }

      // 2. check no_user_overlap
      if (hardConstraints.includes(HardConstraintType.NO_USER_OVERLAP)) {
         const hasOverlap = alreadyScheduled.some(s => 
            s.date === date && 
            s.assignedUsers.includes(user.id) && 
            ((start >= s.startTime && start < s.endTime) || (end > s.startTime && end <= s.endTime))
         );
         if (hasOverlap) continue;
      }

      // 3. check no_consecutive_shifts (Cấm trực 2 ca liên tiếp trong nhà)
      if (hardConstraints.includes(HardConstraintType.NO_CONSECUTIVE_SHIFTS)) {
         const userShiftsToday = alreadyScheduled.filter(s => s.date === date && s.assignedUsers.includes(user.id));
         const hasConsecutive = userShiftsToday.some(s => s.endTime === start || s.startTime === end);
         if (hasConsecutive) continue;
      }

      // 4. check no_night_after_morning (Cấm trực tối/chiều nếu đã cày ca sáng)
      if (hardConstraints.includes(HardConstraintType.NO_NIGHT_AFTER_MORNING)) {
         const isMorningShift = parseInt(start.split(':')[0]) < 12;
         const userShiftsToday = alreadyScheduled.filter(s => s.date === date && s.assignedUsers.includes(user.id));
         
         const hasMorningSchedule = userShiftsToday.some(s => parseInt(s.startTime.split(':')[0]) < 12);
         const hasNightSchedule = userShiftsToday.some(s => parseInt(s.startTime.split(':')[0]) >= 12);

         if (!isMorningShift && hasMorningSchedule) continue;
         if (isMorningShift && hasNightSchedule) continue;
      }

      selected.push(user.id);
    }

    return selected;
  }

  private findAvailableResources(
    resources: LawResourceDto[],
    activity: LawActivityDto,
    date: string,
    dayOfWeek: number,
    start: string,
    end: string,
    alreadyScheduled: ScheduledActivity[],
    hardConstraints: HardConstraintType[] = []
  ): string[] {
    let requiredLimit = activity.requiredResources?.length || 0;
    if (requiredLimit === 0) return [];

    let selected: string[] = [];

    for (const resource of resources) {
       if (selected.length >= requiredLimit) break;
       
       // Filter requested specific resource list if any
       if (activity.requiredResources && !activity.requiredResources.includes(resource.id)) {
           continue; 
       }

       // check no_resource_overlap
       if (hardConstraints.includes(HardConstraintType.NO_RESOURCE_OVERLAP)) {
         const hasOverlap = alreadyScheduled.some(s => 
            s.date === date && 
            s.assignedResources.includes(resource.id) && 
            ((start >= s.startTime && start < s.endTime) || (end > s.startTime && end <= s.endTime))
         );
         if (hasOverlap) continue;
       }

       selected.push(resource.id);
    }
    return selected;
  }

  private generateDatesList(startStr: string, endStr: string, workingDays: number[], holidays: string[]): string[] {
    const dates: string[] = [];
    let curr = new Date(startStr);
    const end = new Date(endStr);
    
    while(curr <= end) {
       const isoDate = curr.toISOString().split('T')[0];
       const day = curr.getDay() || 7; // Sun is 0 -> 7
       
       if (workingDays.includes(day) && !holidays.includes(isoDate)) {
          dates.push(isoDate);
       }
       curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }

  private calculateEndTime(start: string, durationMinutes: number): string {
    const [hours, minutes] = start.split(':').map(Number);
    const totalMins = hours * 60 + minutes + durationMinutes;
    const endH = Math.floor(totalMins / 60).toString().padStart(2, '0');
    const endM = (totalMins % 60).toString().padStart(2, '0');
    return `${endH}:${endM}`;
  }
}
