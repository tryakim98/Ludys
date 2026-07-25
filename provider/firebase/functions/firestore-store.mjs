const SESSION_COLLECTION = "syntheticSessions";
const CAPABILITY_COLLECTION = "syntheticCapabilityGrants";
const TOMBSTONE_COLLECTION = "syntheticSessionTombstones";
const CONTROL_DOCUMENT = "syntheticStagingControl/current";

function fieldValue(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(fieldValue) } };
  }
  if (typeof value === "object") return { mapValue: { fields: fields(value) } };
  throw new Error("UNSUPPORTED_FIRESTORE_VALUE");
}

function fields(record) {
  return Object.fromEntries(Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, fieldValue(value)]));
}

function plain(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(plain);
  if ("mapValue" in value) return record(value.mapValue.fields ?? {});
  throw new Error("UNSUPPORTED_FIRESTORE_RESPONSE_VALUE");
}

function record(fieldMap) {
  return Object.fromEntries(Object.entries(fieldMap).map(([key, value]) => [key, plain(value)]));
}

function sessionDocument(aggregate) {
  return {
    syntheticSessionId: aggregate.syntheticSessionId,
    stateVersion: aggregate.lifecycle.version,
    authorityGeneration: aggregate.lifecycle.authorityGeneration,
    controlEpoch: aggregate.controlEpoch,
    syntheticSessionState: {
      locale: aggregate.lifecycle.locale,
      state: aggregate.lifecycle.state,
      createdAt: aggregate.lifecycle.createdAt,
      updatedAt: aggregate.lifecycle.updatedAt,
      resumeTarget: aggregate.lifecycle.resumeTarget,
      recoveryTarget: aggregate.lifecycle.recoveryTarget,
      helpRequested: aggregate.lifecycle.helpRequested,
      childProjectionToken: aggregate.lifecycle.childProjectionToken,
      adultProjectionToken: aggregate.lifecycle.adultProjectionToken,
    },
    releaseIds: aggregate.releaseIds,
    expiresAt: new Date(aggregate.expiresAt),
    tombstone: false,
    processedCommandIds: aggregate.processedCommandIds,
    coarseTechnicalStatus: aggregate.coarseTechnicalStatus,
    dataClassification: aggregate.dataClassification,
  };
}

function aggregateFromDocument(data) {
  const state = data.syntheticSessionState;
  return {
    syntheticSessionId: data.syntheticSessionId,
    dataClassification: data.dataClassification,
    lifecycle: {
      sessionId: data.syntheticSessionId,
      locale: state.locale,
      dataClassification: "SYNTHETIC_TECHNICAL_DRAFT",
      state: state.state,
      version: data.stateVersion,
      authorityGeneration: data.authorityGeneration,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      resumeTarget: state.resumeTarget,
      recoveryTarget: state.recoveryTarget,
      helpRequested: state.helpRequested,
      childProjectionToken: state.childProjectionToken,
      adultProjectionToken: state.adultProjectionToken,
    },
    controlEpoch: data.controlEpoch,
    releaseIds: data.releaseIds,
    expiresAt: data.expiresAt,
    processedCommandIds: data.processedCommandIds,
    coarseTechnicalStatus: data.coarseTechnicalStatus,
  };
}

function grantDocument(grant) {
  return {
    nonce: grant.nonce,
    syntheticSessionId: grant.syntheticSessionId,
    role: grant.role,
    expiresAt: new Date(grant.expiresAt),
    remainingCommands: grant.remainingCommands,
    revoked: grant.revoked,
    dataClassification: "SYNTHETIC_CAPABILITY_METADATA",
  };
}

function documentWrite(name, value, precondition) {
  return {
    update: { name, fields: fields(value) },
    currentDocument: precondition,
  };
}

export class FirestoreRestSyntheticStagingStore {
  #accessToken;
  #accessTokenExpiresAt = 0;

  constructor(projectId, options = {}) {
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error("INVALID_PROJECT_ID");
    this.projectId = projectId;
    const emulator = options.emulatorHost ?? process.env.FIRESTORE_EMULATOR_HOST;
    this.documentRoot = emulator
      ? `http://${emulator}/v1/projects/${projectId}/databases/(default)/documents`
      : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.databaseRoot = this.documentRoot.replace(/\/documents$/u, "");
    this.metadataOrigin = options.metadataOrigin ?? "http://metadata.google.internal";
  }

  async #token() {
    if (this.documentRoot.startsWith("http://127.0.0.1") || this.documentRoot.startsWith("http://localhost")) {
      return undefined;
    }
    if (this.#accessToken && Date.now() < this.#accessTokenExpiresAt - 60_000) return this.#accessToken;
    const response = await fetch(
      `${this.metadataOrigin}/computeMetadata/v1/instance/service-accounts/default/token`,
      { headers: { "Metadata-Flavor": "Google" } },
    );
    if (!response.ok) throw new Error("RUNTIME_IAM_TOKEN_UNAVAILABLE");
    const token = await response.json();
    if (typeof token.access_token !== "string" || typeof token.expires_in !== "number") {
      throw new Error("RUNTIME_IAM_TOKEN_INVALID");
    }
    this.#accessToken = token.access_token;
    this.#accessTokenExpiresAt = Date.now() + token.expires_in * 1000;
    return this.#accessToken;
  }

  async #request(url, init = {}, allowNotFound = false) {
    const token = await this.#token();
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (allowNotFound && response.status === 404) return undefined;
    if (!response.ok) throw new Error(`FIRESTORE_REST_${response.status}`);
    return response.status === 204 ? undefined : response.json();
  }

  #name(path) {
    return `${this.documentRoot}/${path}`;
  }

  async #get(path) {
    const response = await this.#request(this.#name(path), {}, true);
    return response === undefined
      ? undefined
      : { data: record(response.fields ?? {}), updateTime: response.updateTime };
  }

  async #commit(writes) {
    try {
      await this.#request(`${this.databaseRoot}/documents:commit`, {
        method: "POST",
        body: JSON.stringify({ writes }),
      });
      return true;
    } catch (error) {
      if (error instanceof Error && /FIRESTORE_REST_(409|412)/u.test(error.message)) return false;
      throw error;
    }
  }

  async #grants(syntheticSessionId) {
    const response = await this.#request(`${this.databaseRoot}/documents:runQuery`, {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: CAPABILITY_COLLECTION }],
          where: {
            fieldFilter: {
              field: { fieldPath: "syntheticSessionId" },
              op: "EQUAL",
              value: { stringValue: syntheticSessionId },
            },
          },
        },
      }),
    });
    return response
      .filter((item) => item.document)
      .map((item) => ({
        name: item.document.name,
        data: record(item.document.fields ?? {}),
        updateTime: item.document.updateTime,
      }));
  }

  async loadControl() {
    const snapshot = await this.#get(CONTROL_DOCUMENT);
    return snapshot?.data ?? {
      controlEpoch: 1,
      stagingEnabled: false,
      reasonCode: "DISABLED_BY_DEFAULT",
      changedAt: "2026-07-25T00:00:00.000Z",
    };
  }

  async saveControl(next, expectedControlEpoch) {
    const current = await this.#get(CONTROL_DOCUMENT);
    if (
      next.controlEpoch <= expectedControlEpoch
      || (current?.data.controlEpoch ?? 1) !== expectedControlEpoch
    ) return false;
    return this.#commit([documentWrite(
      this.#name(CONTROL_DOCUMENT),
      next,
      current ? { updateTime: current.updateTime } : { exists: false },
    )]);
  }

  async createSession(aggregate, grants) {
    const writes = [
      documentWrite(
        this.#name(`${SESSION_COLLECTION}/${aggregate.syntheticSessionId}`),
        sessionDocument(aggregate),
        { exists: false },
      ),
      ...grants.map((grant) => documentWrite(
        this.#name(`${CAPABILITY_COLLECTION}/${grant.nonce}`),
        grantDocument(grant),
        { exists: false },
      )),
    ];
    return this.#commit(writes);
  }

  async loadSession(syntheticSessionId) {
    const snapshot = await this.#get(`${SESSION_COLLECTION}/${syntheticSessionId}`);
    return snapshot ? aggregateFromDocument(snapshot.data) : undefined;
  }

  async loadTombstone(syntheticSessionId) {
    return (await this.#get(`${TOMBSTONE_COLLECTION}/${syntheticSessionId}`))?.data;
  }

  async loadGrant(nonce) {
    return (await this.#get(`${CAPABILITY_COLLECTION}/${nonce}`))?.data;
  }

  async commitCommand(input) {
    const sessionPath = `${SESSION_COLLECTION}/${input.nextAggregate.syntheticSessionId}`;
    const grantPath = `${CAPABILITY_COLLECTION}/${input.grantNonce}`;
    const [session, grant, tombstone, grants] = await Promise.all([
      this.#get(sessionPath),
      this.#get(grantPath),
      this.#get(`${TOMBSTONE_COLLECTION}/${input.nextAggregate.syntheticSessionId}`),
      input.revokeSessionGrants ? this.#grants(input.nextAggregate.syntheticSessionId) : Promise.resolve([]),
    ]);
    if (
      !session
      || !grant
      || tombstone
      || session.data.stateVersion !== input.expectedStateVersion
    ) return false;
    const writes = [
      documentWrite(
        this.#name(sessionPath),
        sessionDocument(input.nextAggregate),
        { updateTime: session.updateTime },
      ),
      documentWrite(
        this.#name(grantPath),
        {
          ...grant.data,
          remainingCommands: input.nextRemainingCommands,
          revoked: input.revokeSessionGrants,
        },
        { updateTime: grant.updateTime },
      ),
    ];
    if (input.revokeSessionGrants) {
      for (const candidate of grants) {
        writes.push(documentWrite(
          candidate.name,
          { ...candidate.data, revoked: true },
          { updateTime: candidate.updateTime },
        ));
      }
    }
    return this.#commit(writes);
  }

  async deleteSession(aggregate, tombstone) {
    const sessionPath = `${SESSION_COLLECTION}/${aggregate.syntheticSessionId}`;
    const [session, existingTombstone, grants] = await Promise.all([
      this.#get(sessionPath),
      this.#get(`${TOMBSTONE_COLLECTION}/${aggregate.syntheticSessionId}`),
      this.#grants(aggregate.syntheticSessionId),
    ]);
    if (
      !session
      || existingTombstone
      || session.data.stateVersion + 1 !== aggregate.lifecycle.version
    ) return false;
    return this.#commit([
      {
        delete: this.#name(sessionPath),
        currentDocument: { updateTime: session.updateTime },
      },
      documentWrite(
        this.#name(`${TOMBSTONE_COLLECTION}/${aggregate.syntheticSessionId}`),
        {
          ...tombstone,
          deletedAt: new Date(tombstone.deletedAt),
          dataClassification: "MINIMUM_NO_RESURRECTION_TOMBSTONE",
        },
        { exists: false },
      ),
      ...grants.map((grant) => documentWrite(
        grant.name,
        { ...grant.data, revoked: true },
        { updateTime: grant.updateTime },
      )),
    ]);
  }
}
