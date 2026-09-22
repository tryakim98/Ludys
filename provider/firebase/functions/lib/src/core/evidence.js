export function evidenceAfterSupport(provenance) {
    return provenance.length > 0 ? "SUPPORTED_RETRY" : "INDEPENDENT";
}
