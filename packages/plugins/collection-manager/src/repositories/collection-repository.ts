import { Model, Repository } from '@nocobase/database';
import { CollectionModel } from '../models/collection';
import Topo from '@hapi/topo';

interface LoadOptions {
  filter?: any;
  skipExist?: boolean;
}

export class CollectionRepository extends Repository {
  async load(options: LoadOptions = {}) {
    const { filter, skipExist } = options;
    const instances = (await this.find({ filter })) as CollectionModel[];

    const sorter = new Topo.Sorter<Model>();

    const throughModels = [];

    for (const instance of instances) {
      // @ts-ignore
      const fields = await instance.getFields();
      for (const field of fields) {
        if (field['type'] === 'belongsToMany') {
          const throughName = field.options.through;
          if (throughName) {
            throughModels.push(throughName);
          }
        }
      }

      const topoOptions = {
        group: instance.get('name'),
      };

      if (instance.get('inherits')) {
        topoOptions['after'] = instance.get('inherits');
      }

      sorter.add(instance, topoOptions);
    }

    const sorted = sorter.nodes;

    sorted.sort((a, b) => {
      if (throughModels.includes(a.get('name'))) {
        return -1;
      }

      return 1;
    });

    for (const instance of sorted) {
      await instance.load({ skipExist });
    }
  }

  async db2cm(collectionName: string) {
    const collection = this.database.getCollection(collectionName);
    const options = collection.options;
    const fields = [];
    for (const [name, field] of collection.fields) {
      fields.push({
        name,
        ...field.options,
      });
    }
    await this.create({
      values: {
        ...options,
        fields,
      },
    });
  }
}
