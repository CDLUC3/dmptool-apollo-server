import { GraphQLError } from "graphql";
import { MyContext } from "../context";
import { prepareObjectForLogs } from "../logger";
import { InternalServerError } from "../utils/graphQLErrors";
import { Resolvers } from "../types";
import { sendContactUsEmail } from "../services/emailService";


export const resolvers: Resolvers = {
  Mutation: {
    submitContactForm: async (
      _,
      { input },
      context: MyContext,
    ): Promise<boolean> => {
      const reference = 'contactUs resolver';
      try {
        const { name, email, subject, message } = input;
        return await sendContactUsEmail(context, name, email, subject, message);
      } catch (err) {
        if (err instanceof GraphQLError) throw err;

        context.logger.error(
          prepareObjectForLogs(err),
          `Failure in ${reference}`,
        );
        throw InternalServerError();
      }
    },
  },
};
