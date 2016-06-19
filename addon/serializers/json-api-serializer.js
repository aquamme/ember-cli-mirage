// jscs:disable requireParenthesesAroundArrowParam
import Serializer from '../serializer';
import { dasherize, pluralize, camelize } from '../utils/inflector';

import _get from 'lodash/object/get';
import _ from 'lodash';
import _isEmpty from 'lodash/lang/isEmpty';
import _includes from 'lodash/collection/includes';

export default Serializer.extend({

  keyForModel(modelName) {
    return dasherize(modelName);
  },

  keyForCollection(modelName) {
    return dasherize(modelName);
  },

  keyForAttribute(attr) {
    return dasherize(attr);
  },

  keyForRelationship(key) {
    return dasherize(key);
  },

  buildPayload(primaryResource, toInclude, didSerialize, json) {
    if (!primaryResource && _isEmpty(toInclude)) {
      return json;

    } else if (primaryResource) {
      let [ resourceHash, newIncludes ] = this.getHashForPrimaryResource(primaryResource);
      let newDidSerialize = (this.isCollection(primaryResource) ? primaryResource.models : [ primaryResource ]);

      return this.buildPayload(undefined, newIncludes, newDidSerialize, resourceHash);

    } else {
      let nextIncludedResource = toInclude.shift();
      let [ resourceHash, newIncludes ] = this.getHashForIncludedResource(nextIncludedResource);

      let newToInclude = newIncludes
        .filter(resource => {
          return !_includes(didSerialize.map(m => m.toString()), resource.toString());
        })
        .concat(toInclude);
      let newDidSerialize = (this.isCollection(nextIncludedResource) ? nextIncludedResource.models : [ nextIncludedResource ])
        .concat(didSerialize);
      let newJson = this.mergePayloads(json, resourceHash);

      return this.buildPayload(undefined, newToInclude, newDidSerialize, newJson);
    }
  },

  getHashForPrimaryResource(resource) {
    let [ resourceHash, addToIncludes ] = this.getHashForResource(resource);
    let hashWithRoot = {
      data: resourceHash
    };

    return [ hashWithRoot, addToIncludes ];
  },

  getHashForIncludedResource(resource) {
    let [ hash, addToIncludes ] = this.getHashForResource(resource);
    let hashWithRoot = { included: (this.isModel(resource) ? [ hash ] : hash) };

    return [ hashWithRoot, addToIncludes ];
  },

  getHashForResource(resource) {
    let hash;

    if (this.isModel(resource)) {
      hash = this._getResourceObjectForModel(resource);
    } else {
      hash = resource.models.map(m => this._getResourceObjectForModel(m));
    }

    // let addToIncludes = []

    let serializer = this.serializerFor(resource.modelName);
    let addToIncludes = _(serializer.getKeysForIncluded())
      .map(key => {
        if (this.isCollection(resource)) {
          return resource.models.map(m => m[key]);
        } else {
          return resource[key];
        }
      })
      .flatten()
      .compact()
      .uniq(m => m.toString())
      .value();

    // let linkData = this._linkDataFor(model);
    //
    // model.associationKeys.forEach(camelizedType => {
    //   let relationship = this._getRelatedValue(model, camelizedType);
    //   let relationshipKey = this.keyForRelationship(camelizedType);
    //
    //   if (this.isCollection(relationship)) {
    //     if (!obj.relationships) {
    //       obj.relationships = {};
    //     }
    //
    //     obj.relationships[relationshipKey] = {
    //       data: relationship.models.map(model => {
    //         return {
    //           type: this.typeKeyForModel(model),
    //           id: model.id
    //         };
    //       })
    //     };
    //   } else if (relationship) {
    //     if (!obj.relationships) {
    //       obj.relationships = {};
    //     }
    //
    //     obj.relationships[relationshipKey] = {
    //       data: {
    //         type: this.typeKeyForModel(relationship),
    //         id: relationship.id
    //       }
    //     };
    //   }
    //
    //   if (linkData && linkData[camelizedType]) {
    //     this._addLinkData(obj, relationshipKey, linkData[camelizedType]);
    //   }
    // });

    return [ hash, addToIncludes ];
  },

  getKeysForIncluded() {
    if (_get(this, 'request.queryParams.include')) {
      let relationships = this.request.queryParams.include;
      return relationships
        .split(',')
        .map(camelize);
      // let expandedRelationships = relationships
      //   .split(',')
      //   .map(_trim)
      //   .map((r) => r.split('.').map((_, index, elements) => elements.slice(0, index + 1).join('.')));
      // let relationshipNames = _flatten(expandedRelationships);
      // debugger;
    } else {
      return Serializer.prototype.getKeysForIncluded.apply(this, arguments);
    }
    // if (_isEmpty(this.include))
    // debugger;
    // return _isFunction(this.include) ? this.include(this.request) : this.include;
  },

  _getResourceObjectForModel(model) {
    let attrs = this._attrsForModel(model, true);
    delete attrs.id;

    let hash = {
      type: this.typeKeyForModel(model),
      id: model.id,
      attributes: attrs
    };

    model.associationKeys.forEach(key => {
      let relationship = model[key];
      let relationshipKey = this.keyForRelationship(key);
      let relationshipHash;
      hash.relationships = hash.relationships || {};

      if (this.hasLinksForRelationship(model, key)) {
        let serializer = this.serializerFor(model.modelName);
        let links = serializer.links(model);
        relationshipHash = { links: links[key] };

      } else {
        let data = null;

        if (this.isModel(relationship)) {
          data = {
            type: this.typeKeyForModel(relationship),
            id: relationship.id
          };
        } else if (this.isCollection(relationship)) {
          data = relationship.models.map(model => {
            return {
              type: this.typeKeyForModel(model),
              id: model.id
            };
          });
        }

        relationshipHash = { data };
      }

      hash.relationships[relationshipKey] = relationshipHash;
    });

    return hash;
  },

  hasLinksForRelationship(model, relationshipKey) {
    let serializer = this.serializerFor(model.modelName);
    let links;
    if (serializer.links) {
      links = serializer.links(model);

      return links[relationshipKey] != null;
    }
  },

  // serialize(modelOrCollection, request={}) {
  //   let response;
  //
  //   if (this.isModel(modelOrCollection)) {
  //     response = this._serializeModel(modelOrCollection, request);
  //   } else {
  //     response = this._serializeCollection(modelOrCollection, request);
  //   }
  //
  //   if (this.included.length) {
  //     response.included = this.included;
  //   }
  //
  //   return response;
  // }
  //
  // keyForAttribute(attr) {
  //   return dasherize(attr);
  // }
  //
  // keyForRelationship(key) {
  //   return dasherize(key);
  // }
  //
  // keyForRelationshipIds(modelName) {
  //   return `${singularize(modelName)}Ids`;
  // }

  typeKeyForModel(model) {
    return dasherize(pluralize(model.modelName));
  }

  // toString() {
  //   return `serializer:${this.type}`;
  // }
  //
  // _serializeModel(model, request) {
  //   this._augmentAlreadySerialized(model);
  //
  //   let response = {
  //     data: this._resourceObjectFor(model, request)
  //   };
  //
  //   this._serializeRelationshipsFor(model, request);
  //
  //   return response;
  // }
  //
  // _serializeCollection(collection, request) {
  //   let response = {
  //     data: collection.models.map(model => this._resourceObjectFor(model, request))
  //   };
  //
  //   collection.models.forEach(model => {
  //     this._serializeRelationshipsFor(model, request);
  //   });
  //
  //   return response;
  // }
  //
  // _serializeIncludedModel(model, request) {
  //   if (this._hasBeenSerialized(model)) {
  //     return;
  //   }
  //   this._augmentAlreadySerialized(model);
  //
  //   this.included.push(this._resourceObjectFor(model, request));
  //   this._serializeRelationshipsFor(model, request);
  // }
  //
  // _serializeForeignKey(key) {
  //   return dasherize(key);
  // }

  // _getRelationshipNames(request = {}) {
  //   let requestRelationships = _get(request, 'queryParams.include');
  //   let relationships;
  //
  //   if (_isString(requestRelationships)) {
  //     relationships = requestRelationships;
  //   } else {
  //     relationships = _get(this, 'include', []).join(',');
  //   }
  //
  //   if (relationships.length) {
  //     let expandedRelationships = relationships
  //       .split(',')
  //       .map(_trim)
  //       .map((r) => r.split('.').map((_, index, elements) => elements.slice(0, index + 1).join('.')));
  //
  //     return _flatten(expandedRelationships);
  //   }
  //   return [];
  // }

});
