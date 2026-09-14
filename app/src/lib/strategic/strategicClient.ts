import { getSupabaseClient } from '../supabase/client';
import {
  StrategicDigitalTwin,
  StrategicHealthScore,
  StrategicScenario,
  StrategicBriefing,
  StrategicAlert,
  EnterprisePerformanceModel,
  EnterpriseRiskNetwork,
  OrganizationalDependencyMap,
  StrategicRecommendationItem,
  ScenarioType,
  ScenarioParameters,
  StrategicBriefingType,
  AlertSeverity,
  StrategicAlertType,
} from './types';
import { StrategicService } from './strategicService';
import { PerformanceModelEngine } from './performanceModel';
import { RiskNetworkEngine } from './riskNetworkEngine';
import { DependencyMapEngine } from './dependencyMapEngine';

export class StrategicClient {
  public static async getDigitalTwin(): Promise<StrategicDigitalTwin> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.getLatestDigitalTwin(client, user.id);
  }

  public static async refreshDigitalTwin(): Promise<StrategicDigitalTwin> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.refreshDigitalTwin(client, user.id);
  }

  public static async getHealthScore(): Promise<StrategicHealthScore> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.recordHealthScore(client, user.id);
  }

  public static async getHealthHistory(): Promise<StrategicHealthScore[]> {
    const client = getSupabaseClient();
    return await StrategicService.fetchHealthScoreHistory(client);
  }

  public static async getScenarios(): Promise<StrategicScenario[]> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.fetchScenarios(client, user.id);
  }

  public static async createScenario(
    title: string,
    scenarioType: ScenarioType,
    params: ScenarioParameters,
    description?: string
  ): Promise<StrategicScenario> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.createScenario(client, user.id, title, scenarioType, params, description);
  }

  public static async deleteScenario(scenarioId: string): Promise<boolean> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.softDeleteScenario(client, scenarioId, user.id);
  }

  public static async getPerformanceModel(): Promise<EnterprisePerformanceModel> {
    try {
      const client = getSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/strategic/performance', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) return json.data;
        } else if (res.status === 403 || res.status === 401) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Access denied: Enterprise or Admin tier required.');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Access denied') || err.message?.includes('Forbidden')) {
        throw err;
      }
      // fallback only on network issues
    }
    return PerformanceModelEngine.calculatePerformanceModel();
  }

  public static async getRiskNetwork(): Promise<EnterpriseRiskNetwork> {
    try {
      const client = getSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/strategic/risk-network', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) return json.data;
        } else if (res.status === 403 || res.status === 401) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Access denied: Enterprise or Admin tier required.');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Access denied') || err.message?.includes('Forbidden')) {
        throw err;
      }
      // fallback only on network issues
    }
    return RiskNetworkEngine.computeRiskNetwork();
  }

  public static async getDependencyMap(): Promise<OrganizationalDependencyMap> {
    try {
      const client = getSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/strategic/dependency-map', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) return json.data;
        } else if (res.status === 403 || res.status === 401) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Access denied: Enterprise or Admin tier required.');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Access denied') || err.message?.includes('Forbidden')) {
        throw err;
      }
      // fallback only on network issues
    }
    return DependencyMapEngine.computeDependencyMap();
  }

  public static async getRecommendations(): Promise<StrategicRecommendationItem[]> {
    try {
      const client = getSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/strategic/recommendations', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) return json.data;
        } else if (res.status === 403 || res.status === 401) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Access denied: Enterprise or Admin tier required.');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Access denied') || err.message?.includes('Forbidden')) {
        throw err;
      }
      // fallback
    }
    return StrategicService.getStrategicRecommendations();
  }

  public static async getBriefings(): Promise<StrategicBriefing[]> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.fetchBriefings(client, user.id);
  }

  public static async createBriefing(
    briefingType: StrategicBriefingType,
    title?: string
  ): Promise<StrategicBriefing> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.createBriefing(client, user.id, briefingType, title);
  }

  public static async deleteBriefing(briefingId: string): Promise<boolean> {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    return await StrategicService.softDeleteBriefing(client, briefingId, user.id);
  }

  public static async getAlerts(): Promise<StrategicAlert[]> {
    const client = getSupabaseClient();
    return await StrategicService.fetchAlerts(client);
  }

  public static async dismissAlert(alertId: string): Promise<boolean> {
    const client = getSupabaseClient();
    return await StrategicService.dismissAlert(client, alertId);
  }
}
