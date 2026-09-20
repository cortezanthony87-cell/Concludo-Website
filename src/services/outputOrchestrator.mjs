/**
 * Tasklet 1.5: Output Orchestrator
 *
 * Orchestrates the asynchronous, DAG-dependent generation of all planned outputs
 * across distributed worker queues with concurrency limits and retry handling.
 */

export class OutputOrchestrator {
  constructor(options = {}) {
    this.maxConcurrentPerMeeting = options.maxConcurrentPerMeeting || 3;
    this.timeoutMs = options.timeoutMs || 120000; // 120 seconds
    this.jobs = new Map(); // id -> job
  }

  enqueueJob({ bundlePlanId, meetingId, organisationId, outputId, priority = 10, maxRetries = 3 }) {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = {
      id,
      bundle_plan_id: bundlePlanId,
      meeting_id: meetingId,
      organisation_id: organisationId,
      output_id: outputId,
      status: 'QUEUED',
      priority,
      worker_id: null,
      retry_count: 0,
      max_retries: maxRetries,
      started_at: null,
      completed_at: null,
      last_heartbeat: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    return job;
  }

  getActiveJobsForMeeting(meetingId) {
    return Array.from(this.jobs.values()).filter(
      (j) => j.meeting_id === meetingId && j.status === 'PROCESSING'
    );
  }

  /**
   * Atomic claim using in-memory equivalent of SELECT ... FOR UPDATE SKIP LOCKED
   */
  claimNextJob(workerId) {
    this.reapTimedOutJobs();

    // Sort queued jobs by priority desc, created_at asc
    const candidates = Array.from(this.jobs.values())
      .filter((j) => j.status === 'QUEUED' || j.status === 'RETRYING')
      .sort((a, b) => b.priority - a.priority || new Date(a.created_at) - new Date(b.created_at));

    for (const job of candidates) {
      const activeForMeeting = this.getActiveJobsForMeeting(job.meeting_id);
      if (activeForMeeting.length >= this.maxConcurrentPerMeeting) {
        // Skip this job to respect concurrency limit per meeting
        continue;
      }

      job.status = 'PROCESSING';
      job.worker_id = workerId;
      job.started_at = new Date().toISOString();
      job.last_heartbeat = Date.now();
      job.updated_at = new Date().toISOString();
      return job;
    }

    return null;
  }

  recordHeartbeat(jobId, workerId) {
    const job = this.jobs.get(jobId);
    if (job && job.worker_id === workerId && job.status === 'PROCESSING') {
      job.last_heartbeat = Date.now();
      job.updated_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  completeJob(jobId, workerId, result = {}) {
    const job = this.jobs.get(jobId);
    if (!job || job.worker_id !== workerId) {
      throw new Error('Unauthorized or nonexistent job completion');
    }
    job.status = 'COMPLETED';
    job.completed_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();
    job.result = result;
    return job;
  }

  failJob(jobId, workerId, errorMessage) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    
    job.retry_count += 1;
    job.error_message = errorMessage;
    job.updated_at = new Date().toISOString();

    if (job.retry_count <= job.max_retries) {
      job.status = 'RETRYING';
      job.worker_id = null;
    } else {
      job.status = 'FAILED';
      job.completed_at = new Date().toISOString();
    }
    return job;
  }

  reapTimedOutJobs() {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (job.status === 'PROCESSING' && job.last_heartbeat) {
        if (now - job.last_heartbeat > this.timeoutMs) {
          this.failJob(job.id, job.worker_id, 'ORCHESTRATOR_TIMEOUT: Worker exceeded heartbeat timeout');
        }
      }
    }
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }
}
