import { Resolvers } from "../types.js";
import { MyContext } from "../context.js";
import { ForbiddenError, NotFoundError, InternalServerError } from "../utils/graphQLErrors.js";
import { isSuperAdmin } from "../services/authService.js";
import { prepareObjectForLogs } from "../logger.js";
import { isNullOrUndefined } from "../utils/helpers.js";
import { Plan } from "../models/Plan.js";
import { handleAsyncUpdates } from "../services/planService.js";

export const resolvers: Resolvers = {
  Mutation: {
    superSyncPlanMaDMP: async (_, { planId }, context: MyContext): Promise<boolean> => {
      const reference = 'syncPlanMaDMP';
      if (!isSuperAdmin(context.token)) {
        throw ForbiddenError();
      }

      try {
        const plan = await Plan.findById(reference, context, planId);

        if (isNullOrUndefined(plan)) throw NotFoundError();

        // Handle OpenSearch index update and maDMP JSON versioning in Dynamo
        await handleAsyncUpdates(reference, context, plan);

        return true;
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `${reference} error initializing maDMP record`);
        throw InternalServerError();
      }
    }
  }
}
