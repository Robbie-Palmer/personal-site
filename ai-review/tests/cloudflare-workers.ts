export class DurableObject<Env> {
  protected ctx: DurableObjectState;
  protected env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}

export class WorkflowEntrypoint<Env> {
  protected env: Env;

  constructor(_ctx: ExecutionContext, env: Env) {
    this.env = env;
  }
}
