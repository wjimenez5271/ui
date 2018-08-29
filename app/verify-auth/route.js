import Route from '@ember/routing/route';
import RSVP from 'rsvp';
import { get } from '@ember/object';
import { inject as service } from '@ember/service';
import C from 'shared/utils/constants';
import VerifyAuth from 'ui/mixins/verify-auth';

const samlProviders = ['ping', 'adfs', 'keycloak'];

export default Route.extend(VerifyAuth, {
  github: service(),

  model(params/* , transition */) {
    if (window.opener && !get(params, 'login')) {
      let openersGithub = window.opener.ls('github');
      let openerStore   = window.opener.ls('globalStore');
      let qp            = get(params, 'config') || get(params, 'authProvider');
      let type          = `${ qp }Config`;
      let config        = openerStore.getById(type, qp);
      let gh            = get(this, 'github');
      let stateMsg      = 'Authorization state did not match, please try again.';

      if (get(params, 'config') === 'github') {
        return gh.testConfig(config).then((resp) => {
          gh.authorize(resp, openersGithub.get('state'));
        })
          .catch((err) => {
            this.send('gotError', err);
          });
      } else if (samlProviders.includes(get(params, 'config'))) {
        if (window.opener.window.onAuthTest) {
          reply(null, config);
        } else {
          reply({ err: 'failure' });
        }
      }

      if (get(params, 'code')) {
        if (openersGithub.stateMatches(get(params, 'state'))) {
          reply(params.error_description, params.code);
        } else {
          reply(stateMsg);
        }
      }
    }

    if (get(params, 'code') && get(params, 'login')) {
      if (get(this, 'github').stateMatches(get(params, 'state'))) {
        let ghProvider = get(this, 'access.providers').findBy('id', 'github');

        return ghProvider.doAction('login', {
          code:         get(params, 'code'),
          responseType: 'cookie',
          description:  C.SESSION.DESCRIPTION,
          ttl:          C.SESSION.TTL,
        }).then(() => {
          return get(this, 'access').detect()
            .then(() => this.transitionTo('authenticated'));
        });
      }
    }

    function reply(err, code) {
      try {
        window.opener.window.onAuthTest(err, code);
        setTimeout(() => {
          window.close();
        }, 250);

        return new RSVP.promise();
      } catch (e) {
        window.close();
      }
    }
  }

});
