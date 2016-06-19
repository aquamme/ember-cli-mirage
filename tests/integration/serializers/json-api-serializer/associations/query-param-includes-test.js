import Schema from 'ember-cli-mirage/orm/schema';
import Db from 'ember-cli-mirage/db';
import SerializerRegistry from 'ember-cli-mirage/serializer-registry';
import { JSONAPISerializer, Model, hasMany, belongsTo } from 'ember-cli-mirage';
import { module, test, skip } from 'qunit';

module('Integration | Serializers | JSON API Serializer | Associations | Query param includes', {
  beforeEach() {
    this.schema = new Schema(new Db(), {
      wordSmith: Model.extend({
        blogPosts: hasMany()
      }),

      blogPost: Model.extend({
        wordSmith: belongsTo(),
        fineComments: hasMany()
      }),

      fineComment: Model.extend({
        blogPost: belongsTo(),
        category: belongsTo()
      }),

      category: Model.extend({
        labels: hasMany()
      }),

      label: Model
    });
  }
});

test('query param includes work when serializing a model', function(assert) {
  let registry = new SerializerRegistry(this.schema, {
    application: JSONAPISerializer
  });

  let post = this.schema.blogPosts.create();
  post.createWordSmith();
  post.createFineComment();
  post.createFineComment();

  let request = {
    queryParams: {
      include: 'word-smith,fine-comments'
    }
  };

  let result = registry.serialize(post, request);

  assert.propEqual(result, {
    data: {
      type: 'blog-posts',
      id: '1',
      attributes: {},
      relationships: {
        'word-smith': {
          data: { type: 'word-smiths', id: '1' }
        },
        'fine-comments': {
          data: [
            { type: 'fine-comments', id: '1' },
            { type: 'fine-comments', id: '2' }
          ]
        }
      }
    },
    included: [
      {
        type: 'word-smiths',
        id: '1',
        attributes: {},
        relationships: {
          'blog-posts': {
            data: [
              { type: 'blog-posts', id: '1' }
            ]
          }
        }
      },
      {
        type: 'fine-comments',
        id: '1',
        attributes: {},
        relationships: {
          'blog-post': {
            data: { type: 'blog-posts', id: '1' }
          }
        }
      },
      {
        type: 'fine-comments',
        id: '2',
        attributes: {},
        relationships: {
          'blog-post': {
            data: { type: 'blog-posts', id: '1' }
          }
        }
      }
    ]
  });
});

test('query param includes work when serializing a collection', function(assert) {
  let registry = new SerializerRegistry(this.schema, {
    application: JSONAPISerializer
  });

  let post1 = this.schema.blogPosts.create();
  post1.createWordSmith();
  post1.createFineComment();
  post1.createFineComment();
  this.schema.blogPosts.create();

  let request = {
    queryParams: {
      include: 'word-smith,fine-comments'
    }
  };

  let result = registry.serialize(this.schema.blogPosts.all(), request);

  assert.propEqual(result, {
    data: [
      {
        type: 'blog-posts',
        id: '1',
        attributes: {},
        relationships: {
          'word-smith': {
            data: { type: 'word-smiths', id: '1' }
          },
          'fine-comments': {
            data: [
              { type: 'fine-comments', id: '1' },
              { type: 'fine-comments', id: '2' }
            ]
          }
        }
      },
      {
        type: 'blog-posts',
        id: '2',
        attributes: {},
        relationships: {
          'word-smith': {
            data: null
          },
          'fine-comments': {
            data: []
          }
        }
      }
    ],
    included: [
      {
        type: 'word-smiths',
        id: '1',
        attributes: {},
        relationships: {
          'blog-posts': {
            data: [
              { type: 'blog-posts', id: '1' }
            ]
          }
        }
      },
      {
        type: 'fine-comments',
        id: '1',
        attributes: {},
        relationships: {
          'blog-post': {
            data: { type: 'blog-posts', id: '1' }
          }
        }
      },
      {
        type: 'fine-comments',
        id: '2',
        attributes: {},
        relationships: {
          'blog-post': {
            data: { type: 'blog-posts', id: '1' }
          }
        }
      }
    ]
  });
});

test('query param includes take precedence over default server includes', function(assert) {
  let registry = new SerializerRegistry(this.schema, {
    application: JSONAPISerializer,
    blogPost: JSONAPISerializer.extend({
      include: ['wordSmith']
    })
  });

  let post = this.schema.blogPosts.create();
  post.createWordSmith();
  post.createFineComment();
  post.createFineComment();

  let request = {
    queryParams: {
      include: 'fine-comments'
    }
  };

  let result = registry.serialize(post, request);

  assert.propEqual(result, {
    data: {
      type: 'blog-posts',
      id: '1',
      attributes: {},
      relationships: {
        'word-smith': {
          data: { type: 'word-smiths', id: '1' }
        },
        'fine-comments': {
          data: [
            { type: 'fine-comments', id: '1' },
            { type: 'fine-comments', id: '2' }
          ]
        }
      }
    },
    included: [
      {
        type: 'fine-comments',
        id: '1',
        attributes: {},
        relationships: {
          'blog-post': {
            data: { type: 'blog-posts', id: '1' }
          }
        }
      },
      {
        type: 'fine-comments',
        id: '2',
        attributes: {},
        relationships: {
          'blog-post': {
            data: { type: 'blog-posts', id: '1' }
          }
        }
      }
    ]
  });
});

test('query param includes support dot-paths', function(assert) {
  let registry = new SerializerRegistry(this.schema, {
    application: JSONAPISerializer
  });

  this.schema.db.loadData({
    wordSmiths: [{ id: 1, name: 'Sam' }],
    blogPosts: [{ id: 2, wordSmithId: 1, title: 'Lorem Ipsum' }],
    fineComments: [{ id: 3, text: 'Foo', blogPostId: 2 }],
    categories: [{ id: 10, foo: 'bar' }],
    labels: [{ id: 20, name: 'Economics' }]
  });
  let request = {
    queryParams: {
      include: 'wordSmith,fineComments.category.labels'
    }
  };
  let result = registry.serialize(this.schema.blogPosts.first(), request);

  assert.propEqual(result, {
    data: {
      type: 'foos',
      id: '1',
      attributes: {},
      relationships: {
        'bar': {
          data: { type: 'bars', id: '1' }
        }
      }
    },
    included: [
      {
        type: 'bars',
        id: '1',
        attributes: {},
        relationships: {
          'baz': {
            data: { type: 'bazs', id: '1' }
          }
        }
      },
      {
        type: 'bazs',
        id: '1',
        attributes: {},
        relationships: {
          'quuxes': {
            data: [
              { type: 'quuxes', id: '1' },
              { type: 'quuxes', id: '2' }
            ]
          }
        }
      },
      {
        type: 'quuxes',
        id: '1',
        attributes: {},
        relationships: {
          'zomgs': {
            data: [
              { type: 'zomgs', id: '1' },
              { type: 'zomgs', id: '2' }
            ]
          }
        }
      },
      {
        type: 'quuxes',
        id: '2',
        attributes: {},
        relationships: {
          'zomgs': {
            data: [
              { type: 'zomgs', id: '3' },
              { type: 'zomgs', id: '4' }
            ]
          }
        }
      },
      {
        type: 'zomgs',
        id: '1',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '1' }
          }
        }
      },
      {
        type: 'zomgs',
        id: '2',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '2' }
          }
        }
      },
      {
        type: 'zomgs',
        id: '3',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '3' }
          }
        }
      },
      {
        type: 'zomgs',
        id: '4',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '4' }
          }
        }
      },
      {
        type: 'lols',
        id: '1',
        attributes: {}
      },
      {
        type: 'lols',
        id: '2',
        attributes: {}
      },
      {
        type: 'lols',
        id: '3',
        attributes: {}
      },
      {
        type: 'lols',
        id: '4',
        attributes: {}
      }
    ]
  });
});

skip(`dot-paths in the serializer returns related resources`, function(assert) {
  let registry = new SerializerRegistry(this.schema, {
    application: JSONAPISerializer.extend({
      include: ['bar.baz.quuxes.zomgs.lol']
    })
  });

  let foo = this.schema.foos.find(1);
  let request = { queryParams: {} };
  let result = registry.serialize(foo, request);

  assert.propEqual(result, {
    data: {
      type: 'foos',
      id: '1',
      attributes: {},
      relationships: {
        'bar': {
          data: { type: 'bars', id: '1' }
        }
      }
    },
    included: [
      {
        type: 'bars',
        id: '1',
        attributes: {},
        relationships: {
          'baz': {
            data: { type: 'bazs', id: '1' }
          }
        }
      },
      {
        type: 'bazs',
        id: '1',
        attributes: {},
        relationships: {
          'quuxes': {
            data: [
              { type: 'quuxes', id: '1' },
              { type: 'quuxes', id: '2' }
            ]
          }
        }
      },
      {
        type: 'quuxes',
        id: '1',
        attributes: {},
        relationships: {
          'zomgs': {
            data: [
              { type: 'zomgs', id: '1' },
              { type: 'zomgs', id: '2' }
            ]
          }
        }
      },
      {
        type: 'quuxes',
        id: '2',
        attributes: {},
        relationships: {
          'zomgs': {
            data: [
              { type: 'zomgs', id: '3' },
              { type: 'zomgs', id: '4' }
            ]
          }
        }
      },
      {
        type: 'zomgs',
        id: '1',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '1' }
          }
        }
      },
      {
        type: 'zomgs',
        id: '2',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '2' }
          }
        }
      },
      {
        type: 'zomgs',
        id: '3',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '3' }
          }
        }
      },
      {
        type: 'zomgs',
        id: '4',
        attributes: {},
        relationships: {
          'lol': {
            data: { type: 'lols', id: '4' }
          }
        }
      },
      {
        type: 'lols',
        id: '1',
        attributes: {}
      },
      {
        type: 'lols',
        id: '2',
        attributes: {}
      },
      {
        type: 'lols',
        id: '3',
        attributes: {}
      },
      {
        type: 'lols',
        id: '4',
        attributes: {}
      }
    ]
  });
});
