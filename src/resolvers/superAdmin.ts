import { Resolvers } from "../types";
import { MyContext } from "../context";
import { ForbiddenError, NotFoundError, InternalServerError } from "../utils/graphQLErrors";
import { isSuperAdmin } from "../services/authService";
import { prepareObjectForLogs } from "../logger";
import { isNullOrUndefined } from "../utils/helpers";
import { Plan } from "../models/Plan";
import { saveMaDMPVersion } from "../services/planService";

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

        // Synchronize the Plan with its latest maDMP version in the DynamoDB table
        if (await saveMaDMPVersion(reference, context, plan.id, plan.registered)) {
          return true;
        }

        return false;
      } catch (err) {
        context.logger.error(prepareObjectForLogs(err), `${reference} error initializing maDMP record`);
        throw InternalServerError();
      }
    }
  }
}
