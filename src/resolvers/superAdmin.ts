import { Resolvers } from "../types";
import { MyContext } from "../context";
import { ForbiddenError, NotFoundError, InternalServerError } from "../utils/graphQLErrors";
import { isSuperAdmin } from "../services/authService";
import { prepareObjectForLogs } from "../logger";
import { isNullOrUndefined } from "../utils/helpers";
import { Plan } from "../models/Plan";
import { handleAsyncUpdates } from "../services/planService";

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
        // asynchronously so we don't block the Apollo thread
        handleAsyncUpdates(reference, context, plan)
          .catch(err => {
            context.logger.error({ planId, err }, 'Plan post processing failed');
          });

        return true;
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `${reference} error initializing maDMP record`);
        throw InternalServerError();
      }
    }
  }
}
