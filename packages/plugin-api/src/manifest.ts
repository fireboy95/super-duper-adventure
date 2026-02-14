import type { CompatibilityResult, PluginCompatibilityRequirements, PluginManifestV1, ResourceBudgets } from './index.js';

function checkBudget(name: keyof ResourceBudgets, manifest: PluginManifestV1, requirements: PluginCompatibilityRequirements): string[] {
  const errors: string[] = [];
  const manifestValue = manifest.resourceBudgets[name];
  const min = requirements.minResourceBudgets?.[name];
  const max = requirements.maxResourceBudgets?.[name];

  if (typeof min === 'number' && manifestValue < min) {
    errors.push(`resourceBudgets.${name} (${manifestValue}) is below minimum (${min})`);
  }

  if (typeof max === 'number' && manifestValue > max) {
    errors.push(`resourceBudgets.${name} (${manifestValue}) exceeds maximum (${max})`);
  }

  return errors;
}

export function isManifestCompatible(
  manifest: PluginManifestV1,
  requirements: PluginCompatibilityRequirements
): CompatibilityResult {
  const errors: string[] = [];

  if (manifest.apiVersion !== requirements.apiVersion) {
    errors.push(`apiVersion mismatch: expected ${requirements.apiVersion}, got ${manifest.apiVersion}`);
  }

  if (requirements.lensId && manifest.lensId !== requirements.lensId) {
    errors.push(`lensId mismatch: expected ${requirements.lensId}, got ${manifest.lensId}`);
  }

  if (requirements.requiredCapabilities) {
    for (const capability of requirements.requiredCapabilities) {
      if (!manifest.capabilities.includes(capability)) {
        errors.push(`missing required capability: ${capability}`);
      }
    }
  }

  errors.push(
    ...checkBudget('maxUpdateMs', manifest, requirements),
    ...checkBudget('maxDecodeMs', manifest, requirements),
    ...checkBudget('maxEncodeMs', manifest, requirements),
    ...checkBudget('maxHeapMb', manifest, requirements)
  );

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertManifestCompatibility(
  manifest: PluginManifestV1,
  requirements: PluginCompatibilityRequirements
): void {
  const result = isManifestCompatible(manifest, requirements);
  if (!result.ok) {
    throw new Error(`Manifest compatibility check failed: ${result.errors.join('; ')}`);
  }
}
